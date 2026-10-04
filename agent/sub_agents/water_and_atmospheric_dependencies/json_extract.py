def extract_json_object(text: str):
    """Returns the first balanced {...} substring in `text`, or None if none found.

    Some local models (e.g. qwen3.5) occasionally leave leftover chat-template
    scaffolding (markdown fences, `</tool_call>` artifacts) around an otherwise
    valid JSON object. Scanning for brace balance instead of stripping fixed
    markers finds the object regardless of what surrounds it.
    """
    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None
