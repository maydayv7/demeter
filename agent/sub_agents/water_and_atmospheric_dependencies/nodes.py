import json
from langchain_core.messages import HumanMessage, SystemMessage
from agent.sub_agents.water_and_atmospheric_dependencies.physics_engine import predict_outcome
from agent.sub_agents.water_and_atmospheric_dependencies.retrieval import ask_historian, ask_rag
from agent.sub_agents.water_and_atmospheric_dependencies.tools import calculate_vpd, check_ph_safety, web_search
from langchain_core.messages import ToolMessage

TOOL_MAP = {
    "ask_historian": ask_historian,
    "ask_rag": ask_rag,
    "web_search": web_search,
    "calculate_vpd": calculate_vpd,
    "check_ph_safety": check_ph_safety
}

def decide_node(state, model, system_prompt):
    """
    Node 1: Drafts a plan OR calls a tool.
    """
    print(f"   🤔 Thinking (Attempt {state['retry_count'] + 1})...")
    
    # 1. Initialize Messages if empty
    messages = state.get("messages", [])
    if not messages:
        # First turn: Add System Prompt + User Context
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

    # 2. Invoke Model
    response = model.invoke(messages)
    
    # 3. Update Message History
    new_messages = messages + [response]
    
    # 4. Check for Tool Call
    if response.tool_calls:
        print(f"   📞 Calling Tool: {response.tool_calls[0]['name']}")
        return {
            "messages": new_messages, 
            "next_step": "tools"
        }
    
    # 5. No Tool? Parse JSON Plan
    try:
        content = response.content.replace("```json", "").replace("```", "").strip()
        draft = json.loads(content)
    except:
        draft = {} # Handle parsing error gracefully
        
    return {
        "draft_plan": draft, 
        "messages": new_messages,
        "next_step": "simulate",
        "retry_count": state['retry_count'] + 1
    }

def execute_tools_node(state):
    """
    Executes the tool call and returns the result to the LLM.
    """
    print("   ⚙️ Executing Tools...")
    
    # Safety check
    if "messages" not in state or not state["messages"]:
        raise ValueError("No messages found in state to execute tools from.")

    last_message = state["messages"][-1]
    tool_results = []
    
    for tool_call in last_message.tool_calls:
        tool_name = tool_call["name"]
        tool_args = tool_call["args"]
        
        if tool_name in TOOL_MAP:
            try:
                # Execute Tool
                output = TOOL_MAP[tool_name].invoke(tool_args)
                result_content = str(output)
            except Exception as e:
                result_content = f"Error executing {tool_name}: {e}"
        else:
            result_content = f"Error: Tool {tool_name} is not available."
            
        print(f"      -> {tool_name}: {result_content[:50]}...")

        # Create Tool Message
        tool_results.append(ToolMessage(
            tool_call_id=tool_call["id"],
            name=tool_name,
            content=result_content
        ))

    # Return updated history so 'decide_node' sees the answer
    return {"messages": state["messages"] + tool_results}

def simulate_node(state):
    """
    Node 2: The Safety Sandbox.
    """
    print("   🧪 Simulating Outcome...")
    draft = state.get('draft_plan')
    
    if not draft:
        return {"simulation_result": {"passed": False, "reason": "No valid JSON plan generated."}}

    current = state['sensors']
    prediction = predict_outcome(current, draft)
    
    health = prediction.get('predicted_health', 0)
    risk = prediction.get('risk_warning', "None")
    
    result = {"passed": False, "reason": ""}
    
    # Safety Threshold
    if health < 92.0:
        result["reason"] = f"Predicted Health drops to {health}%. Warning: {risk}"
    else:
        result["passed"] = True
        
    return {"simulation_result": result}

def finalize_node(state):
    """
    Node 3: Lock it in.
    """
    print("   ✅ Plan Approved.")
    return {"final_action": state['draft_plan']}