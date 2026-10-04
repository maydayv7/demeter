import json
import ast
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from agent.sub_agents.water_and_atmospheric_dependencies.physics_engine import predict_outcome
from agent.sub_agents.water_and_atmospheric_dependencies.retrieval import ask_historian, ask_rag, diagnose_plant, ask_memory
from agent.sub_agents.water_and_atmospheric_dependencies.tools import calculate_vpd, web_search, check_ph_safety
from agent.sub_agents.water_and_atmospheric_dependencies.json_extract import extract_json_object
from agent.guardrails.validation import validate_bounds, HARD_BOUNDS

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

def validate_plan_constraints(draft):
    """
    Check if draft plan violates hard constraints.
    Returns (is_valid, violation_message)
    """
    if not isinstance(draft, dict) or not draft:
        return False, "Plan must be a non-empty JSON object"
    
    violations = []
    for param, value in draft.items():
        if param in HARD_BOUNDS:
            # Skip None values (no-ops)
            if value is None or (isinstance(value, (int, float)) and value == 0):
                continue
            
            is_valid, message = validate_bounds(param, value)
            if not is_valid:
                violations.append(message)
    
    if violations:
        return False, "\n".join(violations)
    return True, ""

def decide_node(state, model, system_prompt):
    """
    Node 1: Drafts a plan OR calls a tool.

    `model` has tools bound; `plain_model` is the same underlying LLM with no
    tools bound, used once the tool-round cap is hit so the model physically
    cannot call another tool and must answer directly.
    """
    retry_num = state['retry_count'] + 1
    print(f"   🤔 Thinking (Attempt {retry_num}/3)...")
    
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
    else:
        # On retry, check if there's new critique to add
        if state.get("critique"):
            # Add critique as a new feedback message
            critique_msg = HumanMessage(content=f"❌ PREVIOUS ATTEMPT FAILED: {state['critique']}\n\nPlease try a different plan.")
            messages = messages + [critique_msg]

    new_messages = messages + [response]

    if response.tool_calls:
        print(f"   📞 Calling Tool: {response.tool_calls[0]['name']}")
        return {
            "messages": new_messages,
            "next_step": "tools",
            "tool_round_count": tool_round_count + 1,
        }

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
            draft = ast.literal_eval(content)
        except Exception as e:
            draft = {}
        
    return {
        "draft_plan": draft, 
        "messages": new_messages,
        "next_step": "simulate",
        "retry_count": retry_num
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
    print("   🧪 Simulating Outcome...")
    draft = state.get('draft_plan')

    if not draft:
        return {"simulation_result": {"passed": True, "reason": "No valid JSON plan generated."}}
    
    # 🛡️ CHECK CONSTRAINTS BEFORE SIMULATION (avoid wasting LLM calls)
    is_valid, violation_msg = validate_plan_constraints(draft)
    if not is_valid:
        critique = f"Hard constraint violation:\n{violation_msg}"
        return {
            "simulation_result": {
                "passed": False,
                "reason": critique
            },
            "critique": critique  # Pass back to LLM for next retry
        }

    current = state['sensors']
    
    # Ensure physics engine is imported correctly at top
    prediction = predict_outcome(current, draft)

    health = prediction.get('predicted_health', 0)
    risk = prediction.get('risk_warning', "None")

    result = {"passed": True, "reason": ""}

    if health < 92.0:
        result["reason"] = f"Predicted Health drops to {health}%. Warning: {risk}"
    
    if health < 70.0:
        reason = f"Predicted Health drops to {health}%. Warning: {risk}"
        result["reason"] = reason
        result["passed"] = False
        return {
            "simulation_result": result,
            "critique": reason  # Pass back to LLM for next retry
        }
    else:
        result["passed"] = True

    return {
        "simulation_result": result,
        "critique": result["reason"] if not result["passed"] else None,
    }

def finalize_node(state):
    plan = state['draft_plan']
    print("   ✅ Plan Approved.")
    reason = state.get("simulation_result", {}).get("reason", "")
    if reason:
        print(f"      Reason: {reason}")
    return {"final_action": plan}