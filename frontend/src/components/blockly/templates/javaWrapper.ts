import { extractFunctions } from '../utils/javaCodeGenerator';
import { inferJavaType, inferJavaReturnType, convertPythonToJava } from '../utils/javaCodeGenerator';
import { ExtractedFunction, FunctionParam } from '../types/javaGenerator';

export const generateJavaWrapper = (pythonCode: string, functions: ExtractedFunction[]): string => {
  return `
import com.google.gson.Gson;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Value;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.logging.Level;
import java.util.logging.Logger;

public class PythonWrapper {
    private static final String PYTHON_CODE = """
${pythonCode}
    """;

    private static final Logger logger = Logger.getLogger(PythonWrapper.class.getName());
    private static final Gson gson = new Gson();

    // 요청마다 안전하게 Context 생성
    private static Context createContext() {
        return Context.newBuilder("python")
                .allowIO(true)
                .allowExperimentalOptions(true)
                .allowAllAccess(false)
                .allowNativeAccess(false)
                .allowCreateThread(false)
                .option("python.ForceImportSite", "true")
                .out(System.out)
                .err(System.err)
                .build();
    }

    // Python 실행 결과 객체
    public static class PythonResult {
        private final Value returnValue;
        private final String output;

        public PythonResult(Value returnValue, String output) {
            this.returnValue = returnValue;
            this.output = output;
        }

        public Value getReturnValue() { return returnValue; }
        public String getOutput() { return output; }

        // 텍스트 응답용
        public byte[] toPlainTextBytes() {
            StringBuilder sb = new StringBuilder();
            if (output != null && !output.isEmpty()) {
                sb.append("출력:\\n").append(output);
            }
            if (returnValue != null && !returnValue.isNull()) {
                if (sb.length() > 0) sb.append("\\n");
                sb.append("반환값: ").append(returnValue);
            }
            return sb.toString().getBytes(StandardCharsets.UTF_8);
        }
    }

    // Python 코드 실행 유틸
    public static PythonResult executePython() throws IOException {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             PrintStream ps = new PrintStream(baos, true, StandardCharsets.UTF_8)) {
            // 출력 리다이렉션 설정
            PrintStream oldOut = System.out;
            PrintStream oldErr = System.err;
            System.setOut(ps);
            System.setErr(ps);
            
            // Context 생성 및 코드 실행
            Context ctx = createContext();
            Value result = ctx.eval("python", PYTHON_CODE);
            
            // 출력 복원
            System.setOut(oldOut);
            System.setErr(oldErr);
            
            return new PythonResult(result, baos.toString(StandardCharsets.UTF_8));
        }
    }

    // CORS 공통 헤더 추가 헬퍼
    public static class CORSHelper {
        public static void addCORS(HttpExchange ex) {
            Headers h = ex.getResponseHeaders();
            h.add("Access-Control-Allow-Origin", "*");
            h.add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            h.add("Access-Control-Allow-Headers", "Content-Type");
        }
    }

    // HTTP 요청 핸들러
    public static class PythonHttpHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            CORSHelper.addCORS(exchange);

            // Preflight
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            try {
                PythonResult result = executePython();
                byte[] respBytes;

                // /test 경로: JSON 응답
                if ("/test".equals(exchange.getRequestURI().getPath())) {
                    Map<String, Object> respMap = Map.of(
                        "status", "success",
                        "message", "테스트가 성공적으로 실행되었습니다.",
                        "details", Map.of(
                            "output", result.getOutput(),
                            "result", result.getReturnValue().toString()
                        )
                    );
                    String json = gson.toJson(respMap);
                    respBytes = json.getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
                } else {
                    // 기본: 텍스트 응답
                    respBytes = result.toPlainTextBytes();
                    exchange.getResponseHeaders().set("Content-Type", "text/plain; charset=UTF-8");
                }

                exchange.sendResponseHeaders(200, respBytes.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(respBytes);
                }

            } catch (Exception e) {
                logger.log(Level.SEVERE, "Request handling failed", e);
                byte[] err = gson.toJson(Map.of(
                    "status", "error",
                    "message", "실행 중 오류가 발생했습니다.",
                    "error", e.getMessage()
                )).getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
                exchange.sendResponseHeaders(500, err.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(err);
                }
            }
        }
    }

    // 메인: 서버 초기화
    public static void main(String[] args) throws IOException {
        // 테스트 모드 확인
        boolean isTestMode = Boolean.parseBoolean(System.getenv().getOrDefault("TEST_MODE", "false"));
        
        if (isTestMode) {
            // 테스트 모드: Python 코드 실행 및 결과 출력
            try {
                PythonResult result = executePython();
                Map<String, Object> testResponse = Map.of(
                    "status", "success",
                    "message", "테스트가 성공적으로 실행되었습니다.",
                    "details", Map.of(
                        "output", result.getOutput(),
                        "result", result.getReturnValue() != null ? result.getReturnValue().toString() : null
                    )
                );
                System.out.println(gson.toJson(testResponse));
                System.exit(0);
            } catch (Exception e) {
                Map<String, Object> errorResponse = Map.of(
                    "status", "error",
                    "message", "테스트 실행 중 오류가 발생했습니다.",
                    "error", e.getMessage()
                );
                System.err.println(gson.toJson(errorResponse));
                System.exit(1);
            }
        }

        // 서버 모드
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

        // 스레드풀 설정
        server.setExecutor(Executors.newFixedThreadPool(
            Runtime.getRuntime().availableProcessors() * 2
        ));

        // 핸들러 등록
        server.createContext("/", new PythonHttpHandler());
        server.createContext("/test", new PythonHttpHandler());

        server.start();
        System.out.println("서버가 포트 " + port + "에서 시작되었습니다.");
    }
}`};