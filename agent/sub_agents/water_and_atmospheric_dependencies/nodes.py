import json
import ast
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from agent.sub_agents.water_and_atmospheric_dependencies.physics_engine import predict_outcome
from agent.sub_agents.water_and_atmospheric_dependencies.retrieval import ask_historian, ask_rag, diagnose_plant, ask_memory
from agent.sub_agents.water_and_atmospheric_dependencies.tools import calculate_vpd, web_search, check_ph_safety

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

def decide_node(state, model, system_prompt):
    """
    Node 1: Drafts a plan OR calls a tool.
    """
    # print(f"   🤔 Thinking (Attempt {state['retry_count'] + 1})...")
    
    messages = state.get("messages", [])
    if not messages:
        messages = [SystemMessage(content=system_prompt)]
        user_msg = (
            f"Current Sensors: {state['sensors']}\n"
            f"Strategy: {state['strategy']}\n"
            f"Research: {state['research_context']}\n"
            f"History Context: {state.get('history', 'None provided')}\n"
        )
        if state.get("critique"):
            user_msg += f"\n\n❌ PREVIOUS SIMULATION FAILED: {state['critique']}"
            
        messages.append(HumanMessage(content=user_msg))

    response = model.invoke(messages)
    new_messages = messages + [response]
    
    if response.tool_calls:
        print(f"   📞 Calling Tool: {response.tool_calls[0]['name']}")
        return {
            "messages": new_messages, 
            "next_step": "tools"
        }
    
    # print("📝 Drafting Plan: ", response.content)

    content = response.content.replace("```json", "").replace("```", "").strip()
    
    try:
        # 1. Try standard JSON parsing first
        draft = json.loads(content)
    except json.JSONDecodeError:
        try:
            # 2. Fallback: Python literal eval (Handles single quotes)
            # print("   ⚠️ JSON parse failed, trying Python eval...")
            draft = ast.literal_eval(content)
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
    """
    print("   ⚙️ Executing Tools...")
    
    if "messages" not in state or not state["messages"]:
        raise ValueError("No messages found in state.")

    last_message = state["messages"][-1]
    tool_results = []
    
    for tool_call in last_message.tool_calls:
        tool_name = tool_call["name"]
        tool_args = tool_call["args"].copy()
        
        # 🟢 INJECTION LOGIC: Pass image_b64 from state to the COPY
        if tool_name == "diagnose_plant":
            tool_args["image_b64"] = state.get("image_b64")

        if tool_name in TOOL_MAP:
            try:
                output = TOOL_MAP[tool_name].invoke(tool_args)
                result_content = str(output)
            except Exception as e:
                result_content = f"Error executing {tool_name}: {e}"
        else:
            result_content = f"Error: Tool {tool_name} is not available."
            
        print(f"      -> {tool_name}: {result_content[:100]}...") # Truncated log

        tool_results.append(ToolMessage(
            tool_call_id=tool_call["id"],
            name=tool_name,
            content=result_content
        ))

    return {"messages": state["messages"] + tool_results}

def simulate_node(state):
    # print("   🧪 Simulating Outcome...")
    draft = state.get('draft_plan')
    
    if not draft:
        return {"simulation_result": {"passed": True, "reason": "No valid JSON plan generated."}}

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
        
    return {"simulation_result": result}

def finalize_node(state):
    print("   ✅ Plan Approved.")
    # print(f"   Final Plan: {json.dumps(state['draft_plan'], indent=2)}")
    return {"final_action": state['draft_plan']}