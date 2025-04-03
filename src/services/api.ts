import { CodeBlock, CreateCodeBlockDto } from '../types/CodeBlock';

// 개발 환경에서는 localhost:8000을 사용
const API_BASE_URL = 'http://localhost:8000/api';

export interface CodeBlocksResponse {
  blocks: CodeBlock[];
  total: number;
}

interface CodeExecuteResponse {
  output: string;
  error: string;
}

interface CodeVerifyResponse {
  dag_run_id: string;
}

interface CodeVerifyRequest {
  code: string;
  model_name?: string;
}

export interface ModelInfo {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

interface ModelsResponse {
  models: ModelInfo[];
}

export interface VerificationResult {
  result?: {
    elapsed_time?: number;
    result_code?: string;
    message?: string;
  };
  error?: string;
  status?: 'RUNNING' | 'SUCCESS' | 'ERROR';
}

interface OllamaResponse {
  response: string;
}

interface OpenAIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

interface LLMModel {
  name: string;
  type: 'ollama' | 'openai';
  modified_at?: string;
  size?: number;
}

class CodeBlockApi {
  private baseUrl = API_BASE_URL;
  private verifyUrl = `${API_BASE_URL}/proxy/airflow/api/v1/dags/equiv_task/dagRuns`;
  private verifyAuth = 'YWRtaW46dnR3MjEwMzAy'; // 하드코딩된 Base64 인코딩 값
  private ollamaUrl = 'http://localhost:11434';
  private openaiUrl = 'https://api.openai.com/v1/chat/completions';
  private openaiKey = process.env.REACT_APP_OPENAI_API_KEY || '';

  async getCodeBlocks(page: number = 1, limit: number = 10): Promise<CodeBlocksResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/code-blocks?page=${page}&limit=${limit}`);
      if (!response.ok) {
        throw new Error('코드 블록을 가져오는데 실패했습니다.');
      }
      return await response.json();
    } catch (error) {
      console.error('코드 블록 가져오기 오류:', error);
      return { blocks: [], total: 0 };
    }
  }

  async createCodeBlock(data: CreateCodeBlockDto): Promise<CodeBlock> {
    const response = await fetch(`${this.baseUrl}/code-blocks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('코드 블록 생성에 실패했습니다.');
    }

    return await response.json();
  }

  async updateCodeBlock(id: number, data: CreateCodeBlockDto): Promise<CodeBlock> {
    const response = await fetch(`${this.baseUrl}/code-blocks/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('코드 블록 수정에 실패했습니다.');
    }

    return await response.json();
  }

  async deleteCodeBlocks(ids: number[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/code-blocks`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids }),
    });

    if (!response.ok) {
      throw new Error('코드 블록 삭제에 실패했습니다.');
    }
  }

  async executeCode(code: string): Promise<CodeExecuteResponse> {
    const response = await fetch(`${this.baseUrl}/execute-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      throw new Error('코드 실행에 실패했습니다.');
    }

    return await response.json();
  }

  async verifyCode(code: string, model_name: string = "qwen2.5-coder:32b"): Promise<{ dag_run_id: string }> {
    try {
      const response = await fetch(this.verifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${this.verifyAuth}`
        },
        body: JSON.stringify({
          dag_run_id: `rest_call_${Date.now()}`,
          conf: {
            origin_code: code,
            model_name: model_name
          }
        })
      });

      if (!response.ok) {
        throw new Error('코드 검증에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('코드 검증 중 오류:', error);
      throw error;
    }
  }

  async getModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`);
      if (!response.ok) {
        throw new Error('모델 목록을 가져오는데 실패했습니다.');
      }
      const data: ModelsResponse = await response.json();
      return data.models;
    } catch (error) {
      console.error('모델 목록 가져오기 오류:', error);
      return [];
    }
  }

  async getVerificationResult(dagRunId: string): Promise<VerificationResult> {
    try {
      const response = await fetch(
        `${this.baseUrl}/proxy/airflow/api/v1/dags/equiv_task/dagRuns/${dagRunId}/taskInstances/get_result/xcomEntries/return_value`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${this.verifyAuth}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return { status: 'RUNNING' };
        }
        throw new Error(`검증 결과 조회 실패: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('검증 결과 데이터:', data);

      // 응답 데이터 구조 처리
      const result = {
        elapsed_time: 0, // 실제 소요 시간은 나중에 추가
        result_code: data.value, // 전체 검증 결과를 표시
        message: '코드 검증이 완료되었습니다.'
      };

      return { result, status: 'SUCCESS' };
    } catch (error) {
      console.error('검증 결과 조회 중 상세 오류:', error);
      if (error instanceof Error && error.message.includes('404')) {
        return { status: 'RUNNING' };
      }
      if (error instanceof Error) {
        return { error: error.message, status: 'ERROR' };
      }
      return { error: '알 수 없는 오류가 발생했습니다.', status: 'ERROR' };
    }
  }

  async getAvailableModels(): Promise<LLMModel[]> {
    try {
      // Ollama 모델 가져오기
      const ollamaResponse = await fetch(`${this.ollamaUrl}/api/tags`);
      const ollamaData = await ollamaResponse.json();
      const ollamaModels: LLMModel[] = (ollamaData.models || []).map((model: any) => ({
        name: model.name,
        type: 'ollama',
        modified_at: model.modified_at,
        size: model.size
      }));

      // OpenAI 모델 추가
      const openaiModels: LLMModel[] = [
        { name: 'gpt-4', type: 'openai' },
        { name: 'gpt-4-turbo-preview', type: 'openai' },
        { name: 'gpt-3.5-turbo', type: 'openai' }
      ];

      return [...ollamaModels, ...openaiModels];
    } catch (error) {
      console.error('모델 목록 가져오기 오류:', error);
      return [];
    }
  }

  async generateBlockCode(description: string, model: LLMModel): Promise<string> {
    console.log('블록 생성 시작:', { description, model });
    const prompt = `
당신은 Blockly 블록 XML을 생성하는 전문가입니다.
아래 설명에 맞는 Blockly XML 코드를 생성해주세요.

사용 가능한 블록 카테고리:
1. 로직
   - controls_if: if-else 조건문
   - logic_compare: 비교 연산 (==, !=, <, >, <=, >=)
   - logic_operation: 논리 연산 (AND, OR)
   - logic_negate: NOT 연산
   - logic_boolean: true/false 값
   - logic_null: null 값
   - logic_ternary: 삼항 연산자

2. 반복
   - controls_repeat_ext: n번 반복
   - controls_repeat: 정해진 횟수만큼 반복
   - controls_whileUntil: while/until 반복문
   - controls_for: for 반복문
   - controls_forEach: 리스트 순회
   - controls_flow_statements: break/continue

3. 수학
   - math_number: 숫자
   - math_arithmetic: 사칙연산
   - math_single: 단항 연산 (제곱근, 절대값 등)
   - math_trig: 삼각함수
   - math_constant: 수학 상수 (π, e 등)
   - math_number_property: 숫자 속성 (짝수, 소수 등)
   - math_round: 반올림/올림/내림
   - math_modulo: 나머지 연산
   - math_random_int: 난수 생성

4. 텍스트
   - text: 문자열
   - text_multiline: 여러 줄 문자열
   - text_join: 문자열 결합
   - text_append: 문자열 추가
   - text_length: 문자열 길이
   - text_isEmpty: 빈 문자열 확인
   - text_indexOf: 문자열 검색
   - text_charAt: 문자 추출
   - text_getSubstring: 부분 문자열
   - text_changeCase: 대소문자 변환
   - text_trim: 공백 제거
   - text_print: 출력

5. 리스트
   - lists_create_with: 리스트 생성
   - lists_repeat: 반복값으로 리스트 생성
   - lists_length: 리스트 길이
   - lists_isEmpty: 빈 리스트 확인
   - lists_indexOf: 요소 검색
   - lists_getIndex: 요소 가져오기
   - lists_setIndex: 요소 설정
   - lists_getSublist: 부분 리스트
   - lists_sort: 정렬
   - lists_reverse: 역순 정렬

6. 변수
   - variables_get: 변수 값 가져오기
   - variables_set: 변수 값 설정하기

7. 함수
   - procedures_defnoreturn: 반환값 없는 함수 정의
   - procedures_defreturn: 반환값 있는 함수 정의
   - procedures_callnoreturn: 함수 호출 (반환값 없음)
   - procedures_callreturn: 함수 호출 (반환값 있음)

설명: ${description}

다음 형식으로만 응답해주세요:
<xml>
[생성된 Blockly XML 코드]
</xml>

주의사항:
1. XML 태그 외의 다른 설명이나 주석을 포함하지 마세요.
2. 블록의 x, y 좌표는 각각 50, 50으로 시작하여 적절히 배치하세요.
3. 복잡한 기능은 여러 블록을 조합하여 구현하세요.
4. 변수나 함수 이름은 명확하고 의미있게 지정하세요.
5. 사용자의 요구사항을 가장 잘 구현할 수 있는 블록들을 선택하세요.
6. 필요한 경우 중첩 블록을 사용하여 복잡한 로직을 구현하세요.
7. 가능한 한 재사용 가능하고 모듈화된 코드를 생성하세요.
`;

    try {
      let response;
      
      if (model.type === 'ollama') {
        console.log('Ollama API 호출 시작');
        const requestBody = {
          model: model.name,
          prompt: prompt,
          stream: false,
          temperature: 0.7,
          top_p: 0.9
        };
        console.log('Ollama 요청 데이터:', requestBody);

        response = await fetch(`${this.ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Ollama API 오류:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
          throw new Error(`Ollama API 호출 실패: ${response.status} ${response.statusText}`);
        }

        const data: OllamaResponse = await response.json();
        console.log('Ollama 응답 데이터:', data);
        const xmlMatch = data.response.match(/<xml>[\s\S]*<\/xml>/);
        
        if (!xmlMatch) {
          console.error('XML 생성 실패. 응답:', data.response);
          throw new Error('유효한 XML 코드를 생성하지 못했습니다.');
        }

        console.log('생성된 XML:', xmlMatch[0]);
        return xmlMatch[0];
      } else {
        console.log('OpenAI API 호출 시작');
        if (!this.openaiKey) {
          throw new Error('OpenAI API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
        }

        const requestBody = {
          model: model.name,
          messages: [
            {
              role: 'system',
              content: 'You are a Blockly XML code generation expert.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        };
        console.log('OpenAI 요청 데이터:', requestBody);

        response = await fetch(this.openaiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.openaiKey}`
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('OpenAI API 오류:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
          throw new Error(`OpenAI API 호출 실패: ${response.status} ${response.statusText}`);
        }

        const data: OpenAIResponse = await response.json();
        console.log('OpenAI 응답 데이터:', data);
        const content = data.choices[0]?.message?.content;
        const xmlMatch = content?.match(/<xml>[\s\S]*<\/xml>/);

        if (!xmlMatch) {
          console.error('XML 생성 실패. 응답:', content);
          throw new Error('유효한 XML 코드를 생성하지 못했습니다.');
        }

        console.log('생성된 XML:', xmlMatch[0]);
        return xmlMatch[0];
      }
    } catch (error) {
      console.error('블록 코드 생성 중 오류:', error);
      throw error;
    }
  }
}

export const codeBlockApi = new CodeBlockApi(); 