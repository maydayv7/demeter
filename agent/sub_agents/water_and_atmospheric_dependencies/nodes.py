import json
import ast
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from agent.sub_agents.water_and_atmospheric_dependencies.physics_engine import predict_outcome
from agent.sub_agents.water_and_atmospheric_dependencies.retrieval import ask_historian, ask_rag, diagnose_plant, ask_memory
from agent.sub_agents.water_and_atmospheric_dependencies.tools import calculate_vpd, web_search, check_ph_safety
from agent.sub_agents.water_and_atmospheric_dependencies.json_extract import extract_json_object

# 🟢 Add diagnose_plant and ask_memory to the map
TOOL_MAP = {
    "ask_historian": ask_historian,
    "ask_rag": ask_rag,
    "web_search": web_search,
    "calculate_vpd": calculate_vpd,
    "diagnose_plant": diagnose_plant,
    "ask_memory": ask_memory,
    "check_ph_safety": check_ph_safety
}

# Cap on how many tool-calling rounds a single decide loop can make before
# it's forced to answer directly (no tools) — small models can otherwise
# call the same/similar tool indefinitely without ever committing to a plan.
MAX_TOOL_ROUNDS = 4

def decide_node(state, model, plain_model, system_prompt):
    """
    Node 1: Drafts a plan OR calls a tool.

    `model` has tools bound; `plain_model` is the same underlying LLM with no
    tools bound, used once the tool-round cap is hit so the model physically
    cannot call another tool and must answer directly.
    """
    # print(f"   🤔 Thinking (Attempt {state['retry_count'] + 1})...")

    messages = state.get("messages", [])
    tool_round_count = state.get("tool_round_count", 0)
    force_final = tool_round_count >= MAX_TOOL_ROUNDS

    if not messages:
        messages = [SystemMessage(content=system_prompt)]
        user_msg = (
            f"Current Sensors: {state['sensors']}\n"
            f"Strategy: {state['strategy']}\n"
            f"Research: {state['research_context']}\n"
            f"History Context: {state.get('history', 'None provided')}\n"
        )
        messages.append(HumanMessage(content=user_msg))
    elif state.get("critique"):
        # Retry: tell the model exactly why its last plan was rejected so it can
        # course-correct, instead of silently repeating (or degrading from) it.
        messages = messages + [HumanMessage(
            content=(
                f"❌ Your previous plan was rejected: {state['critique']}\n"
                f"Revise it and respond with ONLY the corrected raw JSON object."
            )
        )]

    if force_final:
        messages = messages + [HumanMessage(
            content=(
                "You have used up your tool-call budget for this cycle. "
                "No more tools are available. Respond now with ONLY your best "
                "raw JSON plan based on everything gathered so far."
            )
        )]
        response = plain_model.invoke(messages)
    else:
        response = model.invoke(messages)

    new_messages = messages + [response]

    if response.tool_calls:
        print(f"   📞 Calling Tool: {response.tool_calls[0]['name']}")
        return {
            "messages": new_messages,
            "next_step": "tools",
            "tool_round_count": tool_round_count + 1,
        }

    # print("📝 Drafting Plan: ", response.content)

    content = response.content.replace("```json", "").replace("```", "").strip()
    # Scan for a balanced {...} object instead of trusting fence-stripping alone —
    # some models leave leftover template scaffolding (e.g. </tool_call>) around it.
    json_candidate = extract_json_object(content) or content

    try:
        # 1. Try standard JSON parsing first
        draft = json.loads(json_candidate)
    except json.JSONDecodeError:
        try:
            # 2. Fallback: Python literal eval (Handles single quotes)
            # print("   ⚠️ JSON parse failed, trying Python eval...")
            draft = ast.literal_eval(json_candidate)
        except Exception as e:
            # print(f"   ❌ Plan Parsing Failed Completely: {e}")
            draft = {}
        
    return {
        "draft_plan": draft, 
        "messages": new_messages,
        "next_step": "simulate",
        "retry_count": state['retry_count'] + 1
    }

def execute_tools_node(state):
    """
    Executes the tool call and returns the result to the LLM.
    Handles 'Hidden State Injection' for heavy data like images.
    Identical (name, args) calls within the same cycle are served from a
    cache instead of re-invoked, since small models tend to repeat calls.
    """
    print("   ⚙️ Executing Tools...")

    if "messages" not in state or not state["messages"]:
        raise ValueError("No messages found in state.")

    last_message = state["messages"][-1]
    tool_results = []
    tool_cache = dict(state.get("tool_cache", {}))

    for tool_call in last_message.tool_calls:
        tool_name = tool_call["name"]
        tool_args = tool_call["args"].copy()

        # 🟢 INJECTION LOGIC: Pass image_b64 from state to the COPY
        if tool_name == "diagnose_plant":
            tool_args["image_b64"] = state.get("image_b64")

        # Dedupe key is based on the args the model actually chose, not the
        # injected image (which is constant within a cycle either way).
        cache_key = f"{tool_name}:{json.dumps(tool_call['args'], sort_keys=True, default=str)}"

        if cache_key in tool_cache:
            result_content = tool_cache[cache_key]
            print(f"      -> {tool_name}: (cached) {result_content[:100]}...")
        elif tool_name in TOOL_MAP:
            try:
                output = TOOL_MAP[tool_name].invoke(tool_args)
                result_content = str(output)
                print(f"      -> {tool_name}: {result_content[:100]}...") # Truncated log
            except Exception as e:
                result_content = f"Error executing {tool_name}: {e}"
            tool_cache[cache_key] = result_content
        else:
            result_content = f"Error: Tool {tool_name} is not available."

        tool_results.append(ToolMessage(
            tool_call_id=tool_call["id"],
            name=tool_name,
            content=result_content
        ))

    return {"messages": state["messages"] + tool_results, "tool_cache": tool_cache}

def simulate_node(state):
    # print("   🧪 Simulating Outcome...")
    draft = state.get('draft_plan')

    if not draft:
        reason = (
            "You did not output a valid JSON plan (empty or unparseable response). "
            "Respond with ONLY a raw JSON object matching the required keys — "
            "no markdown, no extra commentary, no tool calls."
        )
        return {
            "simulation_result": {"passed": False, "reason": reason},
            "critique": reason,
        }

    current = state['sensors']
    # Ensure physics engine is imported correctly at top
    prediction = predict_outcome(current, draft)

    health = prediction.get('predicted_health', 0)
    risk = prediction.get('risk_warning', "None")

    result = {"passed": True, "reason": ""}

    if health < 92.0:
        result["reason"] = f"Predicted Health drops to {health}%. Warning: {risk}"
        result["passed"] = False
    else:
        result["passed"] = True

    return {
        "simulation_result": result,
        "critique": result["reason"] if not result["passed"] else None,
    }

def finalize_node(state):
    print("   ✅ Plan Approved.")
    # print(f"   Final Plan: {json.dumps(state['draft_plan'], indent=2)}")
    return {"final_action": state['draft_plan']}