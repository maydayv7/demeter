"""
🛡️ DEMETER GUARDRAILS - Responsible AI Safety Module
Prevents prompt injection, enforces bounds, detects violations.
"""

import re
import json
from typing import Dict, List, Tuple

# ============================================================================
# HARD BOUNDS - Absolute safety limits for farm operations
# ============================================================================

HARD_BOUNDS = {
    # ATMOSPHERIC PARAMETERS
    "air_temp": {"min": 10, "max": 35, "unit": "°C", "desc": "Air Temperature"},
    "humidity": {"min": 30, "max": 90, "unit": "%", "desc": "Relative Humidity"},
    "co2": {"min": 300, "max": 1500, "unit": "ppm", "desc": "CO₂ Level"},
    "light_intensity": {"min": 0, "max": 100, "unit": "%", "desc": "Light Intensity"},
    
    # WATER PARAMETERS
    "ph": {"min": 4.0, "max": 7.5, "unit": "pH", "desc": "pH Level"},
    "ec": {"min": 0.1, "max": 3.0, "unit": "dS/m", "desc": "Electrical Conductivity"},
    "water_temp": {"min": 12, "max": 28, "unit": "°C", "desc": "Water Temperature"},
}

# ============================================================================
# PROMPT INJECTION DETECTION
# ============================================================================

INJECTION_PATTERNS = [
    r"ignore.*instructions",
    r"forget.*previous",
    r"disregard.*prompt",
    r"override.*system",
    r"execute.*command",
    r"ignore.*safety",
    r"bypass.*constraints",
    r"(import|exec|eval|__)",  # Code execution attempts
    r"(SELECT|DROP|DELETE|INSERT).*FROM",  # SQL injection
    r"(curl|wget|bash|sh)\s+",  # Shell command attempts
]

FARM_UNRELATED_KEYWORDS = [
    "bitcoin", "weather", "politics", "personal", "financial advice",
    "medical", "legal", "hack", "jailbreak", "bypass", "crack",
]

# ============================================================================
# VALIDATION FUNCTIONS
# ============================================================================

def sanitize_input(text: str) -> Tuple[str, List[str]]:
    """
    Sanitizes user input to prevent injection attacks.
    
    Returns:
        (cleaned_text, violations_list)
    """
    violations = []
    cleaned = text.strip()
    
    # Check for injection patterns
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, cleaned, re.IGNORECASE):
            violations.append(f"⚠️ Detected potential injection pattern: {pattern}")
    
    # Check for off-topic keywords
    for keyword in FARM_UNRELATED_KEYWORDS:
        if re.search(rf"\b{keyword}\b", cleaned, re.IGNORECASE):
            violations.append(f"⚠️ Query contains off-topic keyword: '{keyword}'")
    
    # Remove markdown code blocks (common injection vector)
    cleaned = re.sub(r"```[\s\S]*?```", "", cleaned)
    cleaned = re.sub(r"`.*?`", "", cleaned)
    
    return cleaned, violations


def validate_bounds(parameter_name: str, value: float) -> Tuple[bool, str]:
    """
    Validates a parameter against hard bounds.
    
    Returns:
        (is_valid, message)
    """
    if parameter_name not in HARD_BOUNDS:
        return False, f"❌ Unknown parameter: {parameter_name}"
    
    bounds = HARD_BOUNDS[parameter_name]
    
    try:
        val = float(value)
    except (ValueError, TypeError):
        return False, f"❌ Invalid value for {parameter_name}: {value} (must be numeric)"
    
    if val < bounds["min"]:
        return False, (
            f"❌ {parameter_name} = {val}{bounds['unit']} is BELOW minimum "
            f"({bounds['min']}{bounds['unit']})"
        )
    
    if val > bounds["max"]:
        return False, (
            f"❌ {parameter_name} = {val}{bounds['unit']} is ABOVE maximum "
            f"({bounds['max']}{bounds['unit']})"
        )
    
    return True, f"✅ {parameter_name} = {val}{bounds['unit']} is valid"


def clamp_to_bounds(parameter_name: str, value: float) -> float:
    """Clamps a value to hard bounds (lossy but safe)."""
    if parameter_name not in HARD_BOUNDS:
        return value
    
    bounds = HARD_BOUNDS[parameter_name]
    return max(bounds["min"], min(bounds["max"], float(value)))


def validate_plan(plan: Dict, agent_type: str = "both") -> Dict:
    """
    Comprehensive plan validation.
    
    Returns:
        {
            "valid": bool,
            "violations": [str],
            "warnings": [str],
            "bounded_plan": dict,
            "severity": "SAFE" | "WARNING" | "CRITICAL"
        }
    """
    violations = []
    warnings = []
    bounded_plan = plan.copy() if plan else {}
    severity = "SAFE"
    
    if not isinstance(plan, dict):
        return {
            "valid": False,
            "violations": ["Plan must be a valid JSON object"],
            "warnings": [],
            "bounded_plan": {},
            "severity": "CRITICAL"
        }
    
    for param, value in plan.items():
        if param not in HARD_BOUNDS:
            warnings.append(f"⚠️ Unknown parameter: {param}")
            continue
        
        try:
            val = float(value)
            is_valid, message = validate_bounds(param, val)
            
            if not is_valid:
                violations.append(message)
                bounded_plan[param] = clamp_to_bounds(param, val)
                severity = "CRITICAL"
            else:
                bounded_plan[param] = val
                
        except (ValueError, TypeError) as e:
            violations.append(f"❌ {param}: Invalid numeric value '{value}'")
            severity = "CRITICAL"
    
    return {
        "valid": len(violations) == 0,
        "violations": violations,
        "warnings": warnings,
        "bounded_plan": bounded_plan,
        "severity": severity
    }


def detect_hard_violations(plan: Dict) -> Tuple[bool, List[str]]:
    """
    Checks if a plan has HARD violations (cannot be auto-fixed).
    
    Returns:
        (has_violations, violation_list)
    """
    violations = []
    
    if not isinstance(plan, dict):
        return True, ["Plan is not a valid dictionary"]
    
    for param, value in plan.items():
        if param not in HARD_BOUNDS:
            continue
            
        try:
            val = float(value)
            bounds = HARD_BOUNDS[param]
            
            # If value is MORE THAN 10% outside bounds → HARD VIOLATION
            overflow = max(0, val - bounds["max"]) / bounds["max"] if bounds["max"] > 0 else 0
            underflow = max(0, bounds["min"] - val) / bounds["min"] if bounds["min"] > 0 else 0
            
            if overflow > 0.1:
                violations.append(
                    f"🚫 HARD VIOLATION: {param} = {val} exceeds max {bounds['max']} by {overflow*100:.1f}%"
                )
            if underflow > 0.1:
                violations.append(
                    f"🚫 HARD VIOLATION: {param} = {val} below min {bounds['min']} by {underflow*100:.1f}%"
                )
                
        except (ValueError, TypeError):
            violations.append(f"🚫 HARD VIOLATION: {param} has non-numeric value: {value}")
    
    return len(violations) > 0, violations


def create_validation_report(plan: Dict) -> str:
    """Creates a human-readable validation report."""
    validation = validate_plan(plan)
    report = []
    
    report.append(f"\n{'='*60}")
    report.append(f"🛡️  VALIDATION REPORT - Severity: {validation['severity']}")
    report.append(f"{'='*60}\n")
    
    if validation["valid"]:
        report.append("✅ PLAN PASSED ALL CHECKS\n")
    else:
        report.append(f"❌ VIOLATIONS ({len(validation['violations'])}):")
        for v in validation["violations"]:
            report.append(f"   {v}")
        report.append("")
    
    if validation["warnings"]:
        report.append(f"⚠️  WARNINGS ({len(validation['warnings'])}):")
        for w in validation["warnings"]:
            report.append(f"   {w}")
        report.append("")
    
    if validation["bounded_plan"] and validation["bounded_plan"] != plan:
        report.append("📊 AUTO-CLAMPED PARAMETERS:")
        for param, value in validation["bounded_plan"].items():
            original = plan.get(param)
            if original != value:
                report.append(f"   {param}: {original} → {value} {HARD_BOUNDS.get(param, {}).get('unit', '')}")
        report.append("")
    
    report.append(f"{'='*60}\n")
    return "\n".join(report)
