import { extractFunctions } from '../utils/javaCodeGenerator';
import { inferJavaType, inferJavaReturnType, convertPythonToJava } from '../utils/javaCodeGenerator';
import { ExtractedFunction, FunctionParam } from '../types/javaGenerator';

export const generateJavaWrapper = (pythonCode: string, functions: ExtractedFunction[]): string => {
  return `
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Value;
import java.util.Map;
import java.util.HashMap;
import java.util.List;
import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;

public class PythonWrapper {
    private static final String PYTHON_CODE = """
${pythonCode}
    """;

    private static Context context;

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
                result.append("출력:\\n").append(output);
            }
            if (returnValue != null && !returnValue.isNull()) {
                if (result.length() > 0) result.append("\\n");
                result.append("반환값: ").append(returnValue);
            }
            return result.toString();
        }
    }

    public static PythonResult executePythonCode() {
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        PrintStream printStream = new PrintStream(outputStream, true, StandardCharsets.UTF_8);
        
        if (context == null) {
            context = Context.newBuilder("python")
                .allowIO(true)
                .allowExperimentalOptions(true)
                .allowAllAccess(false)
                .allowNativeAccess(false)
                .allowCreateThread(false)
                .option("python.ForceImportSite", "true")
                .out(printStream)
                .err(printStream)
                .build();
        }
            
        // Python 코드 실행
        Value result = context.eval("python", PYTHON_CODE);
        
        // 출력 결과 가져오기
        String output = outputStream.toString(StandardCharsets.UTF_8);
        
        return new PythonResult(result, output);
    }

    public static Map<String, Value> executePythonFunctions() {
        if (context == null) {
            context = Context.newBuilder("python")
                .allowIO(false)
                .allowExperimentalOptions(true)
                .allowAllAccess(false)
                .allowNativeAccess(false)
                .allowCreateThread(false)
                .option("python.ForceImportSite", "true")
                .build();
        }
        
        context.eval("python", PYTHON_CODE);
        Value bindings = context.getBindings("python");
        
        Map<String, Value> functions = new HashMap<>();
        ${functions.map(func => `
        if (bindings.hasMember("${func.name}")) {
            functions.put("${func.name}", bindings.getMember("${func.name}"));
        }`).join('\n')}
        
        return functions;
    }

    ${functions.map(func => `
    public static ${inferJavaReturnType(func.returnType)} ${func.name}(${
      func.params.map((p: FunctionParam) => `${inferJavaType(p)} ${p.name}`).join(', ')
    }) {
        Map<String, Value> functions = executePythonFunctions();
        Value func = functions.get("${func.name}");
        if (func == null) {
            throw new RuntimeException("함수 '${func.name}'를 찾을 수 없습니다.");
        }
        Value result = func.execute(${func.params.map((p: FunctionParam) => p.name).join(', ')});
        return ${convertPythonToJava(func.returnType)};
    }`).join('\n\n')}

    public static void main(String[] args) {
        try {
            // 콘솔 출력 인코딩 설정
            System.setOut(new PrintStream(System.out, true, "UTF-8"));
            System.setErr(new PrintStream(System.err, true, "UTF-8"));

            // 테스트 모드 확인
            boolean isTestMode = Boolean.parseBoolean(System.getenv().getOrDefault("TEST_MODE", "false"));
            
            if (isTestMode) {
                // 테스트 모드: Python 코드만 실행
                System.out.println("Python 코드 실행 결과:");
                PythonResult codeResult = executePythonCode();
                System.out.println(codeResult);
                return;
            }
            
            // 서버 모드: HTTP 서버 시작
            int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
            HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
            
            HttpHandler handler = new HttpHandler() {
                @Override
                public void handle(HttpExchange exchange) throws IOException {
                    try {
                        // Python 코드 실행
                        PythonResult result = executePythonCode();
                        String response = result.toString();
                        
                        // CORS 헤더 설정
                        exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
                        exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                        exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
                        
                        // OPTIONS 요청 처리
                        if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
                            exchange.sendResponseHeaders(204, -1);
                            return;
                        }
                        
                        exchange.getResponseHeaders().set("Content-Type", "text/plain; charset=UTF-8");
                        exchange.sendResponseHeaders(200, response.getBytes("UTF-8").length);
                        
                        try (OutputStream os = exchange.getResponseBody()) {
                            os.write(response.getBytes("UTF-8"));
                        }
                    } catch (Exception e) {
                        String error = "Error: " + e.getMessage();
                        
                        // CORS 헤더 설정 (에러 응답에도 필요)
                        exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
                        exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                        exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
                        
                        exchange.sendResponseHeaders(500, error.getBytes().length);
                        try (OutputStream os = exchange.getResponseBody()) {
                            os.write(error.getBytes());
                        }
                    }
                }
            };
            
            // 루트 경로와 /test 경로에 동일한 핸들러 등록
            server.createContext("/", handler);
            server.createContext("/test", handler);
            
            server.setExecutor(null);
            server.start();
            
            System.out.println("서버가 포트 " + port + "에서 시작되었습니다.");
            
        } catch (Exception e) {
            System.err.println("실행 중 오류 발생: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
}`}; 