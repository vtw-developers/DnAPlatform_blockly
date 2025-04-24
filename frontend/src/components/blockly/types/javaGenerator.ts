export interface FunctionParam {
  name: string;
  defaultValue?: string;
}

export interface ExtractedFunction {
  name: string;
  params: FunctionParam[];
  returnType?: string;
} 