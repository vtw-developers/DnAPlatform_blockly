import React, { useRef, useState, useEffect } from 'react';
import { BlocklyWorkspaceProps } from './types/blockly.types';
import { useBlocklySetup } from './hooks/useBlocklySetup';
import { useCodeExecution } from './hooks/useCodeExecution';
import { useVerification } from './hooks/useVerification';
import { useConversion } from './hooks/useConversion';
import { useCodeBlock } from './hooks/useCodeBlock';
import { useModels } from './hooks/useModels';
import { usePopups } from './hooks/usePopups';
import { ExecutionPopup } from './popups/ExecutionPopup';
import { NaturalLanguagePopup } from './popups/NaturalLanguagePopup';
import VerificationPopup from './popups/VerificationPopup';
import { ConversionPopup } from './popups/ConversionPopup';
import { RightPanel } from './panels/RightPanel';
import { useAuth } from '../../contexts/AuthContext';
import { TOOLBOX_CONFIG } from './configs/toolboxConfig';
import './styles/BlocklyWorkspace.css';
import { registerJpypeBlocks } from './customBlocks/jpypeBlocks';
import { Spin } from 'antd';

registerJpypeBlocks();

const BlocklyWorkspace: React.FC<BlocklyWorkspaceProps> = ({ onCodeGenerate }) => {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [currentCode, setCurrentCode] = useState<string>('');
  const [shouldRefresh, setShouldRefresh] = useState(false);
  const { user, isLoading } = useAuth();
  const [wrappedCode, setWrappedCode] = useState<string>('');
   
  
  useEffect(() => {
    console.log('Auth State:', {
      isLoading,
      user,
      userId: user?.id,
      timestamp: new Date().toISOString()
    });
  }, [isLoading, user]);

  const { isOpen, openPopup, closePopup } = usePopups();
  const {
    models,
    selectedModel,
    setSelectedModel,
    isLoadingModels
  } = useModels();

  const { workspace, resetWorkspace } = useBlocklySetup({
    workspaceRef,
    toolboxConfig: TOOLBOX_CONFIG,
    onCodeChange: (code: string) => {
      setCurrentCode(code);
      onCodeGenerate(code);
    }
  });

  const {
    title,
    description,
    isShared,
    selectedBlocks,
    selectedBlockUserId,
    setTitle,
    setDescription,
    handleSave,
    handleCreateBlock,
    handleBlockSelect,
    handleToggleShare,
    handleReset: handleCodeBlockReset
  } = useCodeBlock({
    workspace,
    currentCode,
    onRefresh: () => setShouldRefresh(true)
  });

  const {
    isConversionPopupOpen,
    conversionStatus,
    conversionError,
    convertedCode,
    isConverting,
    conversionDagRunId,
    conversionElapsedTime,
    handleConvert,
    handleCloseConversionPopup
  } = useConversion();

  const {
    verificationStatus,
    verificationResult,
    verificationElapsedTime,
    isVerifying,
    handleVerifyCode,
    handleCloseVerificationPopup,
    verificationDagRunId,
    verificationError
  } = useVerification();

  const {
    executeCode,
    executionStatus,
    executionResult,
    closeExecutionPopup
  } = useCodeExecution();

  const handleExecute = () => {
    openPopup('execution');
    executeCode(currentCode);
  };

  const handleExecuteVerifiedCode = async (code: string) => {
    executeCode(code);
  };

  const handleRefreshComplete = () => {
    setShouldRefresh(false);
  };

  const handleReset = () => {
    resetWorkspace();
    handleCodeBlockReset();
  };

  const handleCloseExecutionPopup = () => {
    closeExecutionPopup();
    closePopup('execution');
  };

  const handleConvertCode = (code: string) => {
    openPopup('conversion');
    handleConvert(code);
  };

  const handleVerifyCodeWithModel = (code: string, model: string) => {
    openPopup('verification');
    handleVerifyCode(code, model);
  };

  const extractFunctions = (pythonCode: string) => {
    const functionRegex = /def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?\s*:/g;
    const functions = [];
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

  const generateJavaMethodSignature = (func: { name: string, params: Array<{ name: string, defaultValue?: string }>, returnType?: string }) => {
    const javaParams = func.params
      .map(p => 'Object ' + p.name)
      .join(', ');
    
    return `public static Value ${func.name}(${javaParams})`;
  };

  const handleLapping = () => {
    if (!currentCode.trim()) {
      alert('랩핑할 Python 코드가 없습니다.');
      return;
    }

    try {
      const functions = extractFunctions(currentCode);
      
      const wrappedJavaCode = `
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Value;
import java.util.Map;
import java.util.HashMap;
import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;

public class PythonWrapper {
    private static final String PYTHON_CODE = """
${currentCode}
    """;

    public static class PythonResult {
        private final Value returnValue;
        private final String output;

        public PythonResult(Value returnValue, String output) {
            this.returnValue = returnValue;
            this.output = output;
        }

        public Value getReturnValue() { return returnValue; }
        public String getOutput() { return output; }
        
        @Override
        public String toString() {
            StringBuilder result = new StringBuilder();
            if (output != null && !output.isEmpty()) {
                result.append("출력:\n").append(output);
            }
            if (returnValue != null && !returnValue.isNull()) {
                if (result.length() > 0) result.append("\n");
                result.append("반환값: ").append(returnValue);
            }
            return result.toString();
        }
    }

    public static PythonResult executePythonCode() {
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        PrintStream printStream = new PrintStream(outputStream);
        
        try (Context context = Context.newBuilder("python")
                .allowIO(true)           // 출력 캡처를 위해 IO 허용
                .allowNativeAccess(false)
                .allowCreateThread(false)
                .out(printStream)         // 표준 출력 리다이렉션
                .err(printStream)         // 표준 에러 리다이렉션
                .build()) {
            
            // Python 코드 실행
            Value result = context.eval("python", PYTHON_CODE);
            
            // 출력 결과 가져오기
            String output = outputStream.toString(StandardCharsets.UTF_8);
            
            return new PythonResult(result, output);
        }
    }

    public static Map<String, Value> executePythonFunctions() {
        try (Context context = Context.newBuilder("python")
                .allowIO(false)
                .allowNativeAccess(false)
                .allowCreateThread(false)
                .build()) {
            
            context.eval("python", PYTHON_CODE);
            Value bindings = context.getBindings("python");
            
            Map<String, Value> functions = new HashMap<>();
            ${functions.map(func => `
            if (bindings.hasMember("${func.name}")) {
                functions.put("${func.name}", bindings.getMember("${func.name}"));
            }`).join('\n')}
            
            return functions;
        }
    }

    ${functions.map(func => `
    public static ${inferJavaReturnType(func.returnType)} ${func.name}(${
      func.params.map(p => `${inferJavaType(p)} ${p.name}`).join(', ')
    }) {
        Map<String, Value> functions = executePythonFunctions();
        Value func = functions.get("${func.name}");
        if (func == null) {
            throw new RuntimeException("함수 '${func.name}'를 찾을 수 없습니다.");
        }
        Value result = func.execute(${func.params.map(p => p.name).join(', ')});
        return ${convertPythonToJava(func.returnType)};
    }`).join('\n\n')}

    public static void main(String[] args) {
        try {
            // 1. 전체 Python 코드 실행
            System.out.println("Python 코드 실행 결과:");
            PythonResult codeResult = executePythonCode();
            System.out.println(codeResult);
            System.out.println();

            // 2. 사용 가능한 함수 확인 및 실행
            Map<String, Value> functions = executePythonFunctions();
            if (!functions.isEmpty()) {
                System.out.println("사용 가능한 Python 함수:");
                for (String funcName : functions.keySet()) {
                    System.out.println("  - " + funcName);
                }
                System.out.println();

                ${functions.map(func => `
                // ${func.name} 함수 테스트
                try {
                    ${inferJavaReturnType(func.returnType)} result = ${func.name}(${
                      func.params.map(p => getDefaultValue(p)).join(', ')
                    });
                    System.out.println("${func.name} 실행 결과: " + result);
                } catch (Exception e) {
                    System.err.println("${func.name} 실행 중 오류: " + e.getMessage());
                }`).join('\n')}
            }
        } catch (Exception e) {
            System.err.println("실행 중 오류 발생: " + e.getMessage());
            e.printStackTrace();
        }
    }
}`;

      setWrappedCode(wrappedJavaCode);
    } catch (error) {
      console.error('코드 랩핑 중 오류:', error);
      alert('코드 랩핑 중 오류가 발생했습니다.');
    }
  };

  const inferJavaType = (param: { name: string, defaultValue?: string }) => {
    if (param.defaultValue) {
      if (/^-?\d+$/.test(param.defaultValue)) return 'int';
      if (/^-?\d*\.\d+$/.test(param.defaultValue)) return 'double';
      if (/^(True|False)$/.test(param.defaultValue)) return 'boolean';
      if (/^[\[\{]/.test(param.defaultValue)) return 'Value';
      return 'String';
    }
    return 'Object';
  };

  const inferJavaReturnType = (pythonType?: string) => {
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

  const convertPythonToJava = (returnType?: string) => {
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

  const getDefaultValue = (param: { name: string, defaultValue?: string }) => {
    if (!param.defaultValue) return 'null';
    if (/^-?\d+$/.test(param.defaultValue)) return param.defaultValue;
    if (/^-?\d*\.\d+$/.test(param.defaultValue)) return param.defaultValue;
    if (/^(True|False)$/.test(param.defaultValue)) return param.defaultValue.toLowerCase();
    if (/^[\[\{]/.test(param.defaultValue)) return 'null /* ' + param.defaultValue + ' */';
    return `"${param.defaultValue}"`;
  };

  if (isLoading) {
    return (
      <div style={{ 
        width: '100%', 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        gap: '16px',
        justifyContent: 'center', 
        alignItems: 'center' 
      }}>
        <Spin size="large" />
        <div>사용자 정보를 불러오는 중...</div>
      </div>
    );
  }

  console.log('BlocklyWorkspace Render:', {
    hasUser: !!user,
    userId: user?.id,
    timestamp: new Date().toISOString()
  });

  return (
    <div className="blockly-container">
      <div className="blockly-workspace-container">
        <div ref={workspaceRef} className="blockly-workspace" />
      </div>

      <RightPanel
        title={title}
        description={description}
        currentCode={currentCode}
        convertedCode={convertedCode}
        isShared={isShared}
        selectedBlocks={selectedBlocks}
        selectedBlockUserId={selectedBlockUserId}
        isConverting={isConverting}
        isVerifying={isVerifying}
        models={models}
        selectedModel={selectedModel}
        isLoadingModels={isLoadingModels}
        shouldRefresh={shouldRefresh}
        currentUser={user}
        onTitleChange={setTitle}
        onDescriptionChange={setDescription}
        onReset={handleReset}
        onSave={handleSave}
        onToggleShare={handleToggleShare}
        onExecute={handleExecute}
        onConvert={handleConvertCode}
        onVerify={handleVerifyCodeWithModel}
        onModelSelect={setSelectedModel}
        onBlockSelect={handleBlockSelect}
        onRefreshComplete={handleRefreshComplete}
        onDeleteComplete={resetWorkspace}
        openPopup={openPopup}
        onLapping={handleLapping}
        wrappedCode={wrappedCode}
      />

      <ExecutionPopup
        isOpen={isOpen.execution}
        onClose={handleCloseExecutionPopup}
        status={executionStatus}
        result={executionResult}
      />

      <NaturalLanguagePopup
        isOpen={isOpen.naturalLanguage}
        onClose={() => closePopup('naturalLanguage')}
        onCreateBlock={handleCreateBlock}
      />

      <VerificationPopup
        isOpen={isOpen.verification}
        onClose={() => {
          handleCloseVerificationPopup();
          closePopup('verification');
        }}
        status={verificationStatus}
        result={verificationResult}
        error={verificationError}
        elapsedTime={verificationElapsedTime}
        dagRunId={verificationDagRunId}
        code={currentCode}
        isVerifying={isVerifying}
        onExecute={handleExecuteVerifiedCode}
        executionResult={executionResult?.output ?? executionResult?.error ?? null}
        isExecuting={executionStatus === '실행 중'}
      />

      <ConversionPopup
        isOpen={isOpen.conversion}
        onClose={() => {
          handleCloseConversionPopup();
          closePopup('conversion');
        }}
        status={conversionStatus}
        dagRunId={conversionDagRunId}
        error={conversionError}
        isConverting={isConverting}
        elapsedTime={conversionElapsedTime}
      />
    </div>
  );
};

export default BlocklyWorkspace; 