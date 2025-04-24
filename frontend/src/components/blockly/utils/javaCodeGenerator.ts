import { FunctionParam, ExtractedFunction } from '../types/javaGenerator';

export const extractFunctions = (pythonCode: string): ExtractedFunction[] => {
  const functionRegex = /def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?\s*:/g;
  const functions: ExtractedFunction[] = [];
  let match;

  while ((match = functionRegex.exec(pythonCode)) !== null) {
    const funcName = match[1];
    const params = match[2].split(',')
      .map(param => param.trim())
      .filter(param => param)
      .map(param => {
        const [name, defaultValue] = param.split('=').map(p => p.trim());
        return { name, defaultValue };
      });
    const returnType = match[3]?.trim();
    
    functions.push({
      name: funcName,
      params,
      returnType
    });
  }

  return functions;
};

export const inferJavaType = (param: FunctionParam): string => {
  if (param.defaultValue) {
    if (/^-?\d+$/.test(param.defaultValue)) return 'int';
    if (/^-?\d*\.\d+$/.test(param.defaultValue)) return 'double';
    if (/^(True|False)$/.test(param.defaultValue)) return 'boolean';
    if (/^[\[\{]/.test(param.defaultValue)) return 'Value';
    return 'String';
  }
  return 'Object';
};

export const inferJavaReturnType = (pythonType?: string): string => {
  if (!pythonType) return 'Value';
  switch (pythonType.trim()) {
    case 'int': return 'int';
    case 'float': return 'double';
    case 'str': return 'String';
    case 'bool': return 'boolean';
    case 'list': return 'List<Object>';
    case 'dict': return 'Map<String, Object>';
    default: return 'Value';
  }
};

export const convertPythonToJava = (returnType?: string): string => {
  if (!returnType) return 'result';
  switch (returnType.trim()) {
    case 'int': return 'result.asInt()';
    case 'float': return 'result.asDouble()';
    case 'str': return 'result.asString()';
    case 'bool': return 'result.asBoolean()';
    case 'list': return 'result.as(List.class)';
    case 'dict': return 'result.as(Map.class)';
    default: return 'result';
  }
}; 