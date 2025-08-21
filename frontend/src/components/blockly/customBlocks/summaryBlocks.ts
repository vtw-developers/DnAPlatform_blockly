import Blockly from 'blockly/core';
import JavaScript from 'blockly/javascript';
import { PythonGenerator } from 'blockly/python';

// 인스턴스 생성
const pythonGenerator = new PythonGenerator();

// 들여쓰기 상수 설정 (Python 표준 4칸 공백)
pythonGenerator.INDENT = '    ';

// 변수명 매핑 캐시
const variableNameCache = new Map<string, string>();
let variableCounter = 0;

// 변수명 정리 함수
function sanitizeVariableName(varName: string): string {
    if (!varName) return 'var';
    
    // 이미 처리된 변수명이 있으면 캐시에서 반환
    if (variableNameCache.has(varName)) {
        return variableNameCache.get(varName)!;
    }
    
    let cleanName = varName;
    
    // 일반적인 변수명인지 확인 (영문자로 시작하고 영문, 숫자, 언더스코어만 포함)
    if (/^[a-zA-Z][a-zA-Z0-9_]*$/.test(varName)) {
        // 이미 유효한 변수명이면 그대로 사용
        cleanName = varName;
    } else {
        // 무작위 생성된 ID 같은 경우 의미있는 이름으로 변환
        if (varName.length > 10 && /[^a-zA-Z0-9_]/.test(varName)) {
            // 변수명이 너무 길고 특수문자가 포함된 경우 간단한 이름으로 변경
            variableCounter++;
            cleanName = `var${variableCounter}`;
        } else {
            // 유효하지 않은 문자들을 제거하고 Python 변수명 규칙에 맞게 변환
            cleanName = varName.replace(/[^a-zA-Z0-9_]/g, '_'); // 영문, 숫자, 언더스코어만 허용
            
            if (/^[0-9]/.test(cleanName)) { // 숫자로 시작하면 앞에 언더스코어 추가
                cleanName = '_' + cleanName;
            }
            
            if (cleanName === '' || cleanName === '_') { // 빈 문자열이나 언더스코어만 있으면 기본값
                variableCounter++;
                cleanName = `var${variableCounter}`;
            }
        }
    }
    
    // 캐시에 저장
    variableNameCache.set(varName, cleanName);
    return cleanName;
}

// 변수명 캐시 초기화 함수
function clearVariableNameCache() {
    variableNameCache.clear();
    variableCounter = 0;
}

console.log(JavaScript)
console.log("valueToCode")
console.log(pythonGenerator.valueToCode)

// Blockly.Block 인터페이스 확장
interface ExtendedBlock extends Blockly.Block {
    parameterCount_?: number;
    updateShape_?: () => void;
}

export function registerSummaryBlocks() {
    // 파라미터 블록
    Blockly.Blocks['ast_FunctionParameter'] = {
        init: function (this: Blockly.Block) {
            this.appendDummyInput()
                .appendField('parameter')
                .appendField(new Blockly.FieldTextInput('x'), 'NAME');
            this.setOutput(true, null);
            this.setColour(230);
            this.setTooltip('Function parameter');
            this.setHelpUrl('');
        }
    };

    // 함수 정의 블록 (parameterCount_ 방식으로 단순화)
    Blockly.Blocks['ast_Summarized_FunctionDef'] = {
        init: function (this: ExtendedBlock) {
            this.appendDummyInput()
                .appendField('Function')
                .appendField(new Blockly.FieldTextInput('func_name'), 'NAME');
            this.setColour(210);
            this.setTooltip('Custom function block with parameter mutation.');
            this.setHelpUrl('');
            this.parameterCount_ = 0;
            // Body 영역 블록 연결을 위해 정의
            this.appendStatementInput('BODY')
                .setCheck(null)
                .appendField('Body');
        },
        mutationToDom: function (this: ExtendedBlock): Element {
            const container = document.createElement('mutation');
            container.setAttribute('parameters', this.parameterCount_?.toString() || '0');
            return container;
        },
        domToMutation: function (this: ExtendedBlock, xmlElement: Element): void {
            const paramCount = parseInt(xmlElement.getAttribute('parameters') || '0', 10);
            this.parameterCount_ = paramCount;
            this.updateShape_?.();
        },
        updateShape_: function (this: ExtendedBlock) {
            // 기존 입력 제거
            let i = 0;
            while (this.getInput('PARAMETER' + i)) {
                this.removeInput('PARAMETER' + i);
                i++;
            }

            // 입력 추가
            for (let j = 0; j < (this.parameterCount_ || 0); j++) {
                this.appendValueInput('PARAMETER' + j)
                    .setCheck(null)
                    .appendField('Param ' + (j + 1));
            }

            // BODY 입력이 항상 마지막에 오도록
            if (this.getInput('BODY')) {
                this.moveInputBefore('BODY', null);
            }
        }
    };

    // Mutator 컨테이너
    Blockly.Blocks['parameters_container'] = {
        init: function (this: Blockly.Block) {
            this.appendDummyInput().appendField('parameters');
            this.appendStatementInput('STACK');
            this.setColour(260);
            this.setTooltip('');
            this.contextMenu = false;
        }
    };

    // ast_function_param_container 블록 추가 (custom_block.js와 동일)
    Blockly.Blocks['ast_function_param_container'] = {
        init: function (this: Blockly.Block) {
            this.appendDummyInput().appendField("parameters");
            this.appendStatementInput("STACK");
            this.setColour(210);
            this.setTooltip("Add parameters");
            this.contextMenu = false;
        }
    };

    // 파라미터 개수 설정 UI 블록
    Blockly.Blocks['ast_function_param_mutator'] = {
        init: function (this: Blockly.Block) {
            this.appendDummyInput()
                .appendField("Number of Parameters:")
                .appendField(new Blockly.FieldNumber(1, 1, 10), 'NUM_PARAMS');
            this.setColour(230);
            this.setTooltip("Set number of parameters.");
            this.setHelpUrl("");
        },
        onchange: function (this: Blockly.Block) {
            const numParams = this.getFieldValue('NUM_PARAMS');
            const block = (this as any).getSourceBlock();
            if (block) {
                (block as any).parameterCount_ = numParams;
                // 변형된 파라미터 개수에 맞게 입력 필드 업데이트
                (block as any).domToMutation((block as any).mutationToDom());
            }
        }
    };

    // 리턴 블록
    Blockly.Blocks['ast_ReturnFull'] = {
        init: function (this: Blockly.Block) {
            this.appendDummyInput().appendField('return');
            this.appendValueInput('VALUE').setCheck(null).appendField('value');
            this.appendDummyInput('HIDDEN_TEXT').appendField(new Blockly.FieldTextInput(''), 'TEXT').setVisible(false);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(160);
            this.setTooltip('Hidden code summary');
            this.setHelpUrl('');
        }
    };

    // 변수 참조 블록
    Blockly.Blocks['ast_Name'] = {
        init: function (this: Blockly.Block) {
            this.appendDummyInput().appendField(new Blockly.FieldTextInput('variable'), 'VAR');
            this.setOutput(true, null);
            this.setColour(210);
            this.setTooltip('Variable reference');
            this.setHelpUrl('');
        }
    };

    // 함수 호출 블록 (파라미터 이름/개수 자동 동기화)
    Blockly.Blocks['procedures_callreturn'] = {
        init: function (this: Blockly.Block & { parameters_?: string[] }) {
            this.appendDummyInput()
                .appendField('call')
                .appendField(new Blockly.FieldTextInput('함수이름'), 'NAME');
            this.setOutput(true, null);
            this.setColour(290);
            this.setTooltip('함수 호출 (리턴값 있음)');
            this.setHelpUrl('');
            this.parameters_ = [];
            (this as any).updateShape_();
        },
        mutationToDom: function (this: Blockly.Block & { parameters_?: string[] }): Element {
            const container = document.createElement('mutation');
            for (const param of this.parameters_ || []) {
                const paramElem = document.createElement('arg');
                paramElem.setAttribute('name', param);
                container.appendChild(paramElem);
            }
            return container;
        },
        domToMutation: function (this: Blockly.Block & { parameters_?: string[] }, xmlElement: Element): void {
            this.parameters_ = [];
            for (const child of Array.from(xmlElement.children)) {
                if (child.nodeName.toLowerCase() === 'arg') {
                    this.parameters_!.push(child.getAttribute('name') || '');
                }
            }
            (this as any).updateShape_();
        },
        updateShape_: function (this: Blockly.Block & { parameters_?: string[] }) {
            let i = 0;
            while (this.getInput('ARG' + i)) {
                this.removeInput('ARG' + i);
                i++;
            }
            for (let j = 0; j < (this.parameters_?.length || 0); j++) {
                this.appendValueInput('ARG' + j)
                    .setCheck(null)
                    .appendField(this.parameters_![j]);
            }
        },
        onchange: function (this: Blockly.Block & { parameters_?: string[] }) {
            if (!this.workspace) return;
            const funcName = this.getFieldValue('NAME');
            const blocks = this.workspace.getAllBlocks(false);
            for (const block of blocks) {
                if (block.type === 'ast_Summarized_FunctionDef' && block.getFieldValue('NAME') === funcName) {
                    const params = (block as any).parameters_ || [];
                    if (JSON.stringify(this.parameters_) !== JSON.stringify(params)) {
                        this.parameters_ = [...params];
                        (this as any).updateShape_();
                    }
                }
            }
        }
    };

    // 함수 호출 블록 (리턴값 없음, 동일 구조)
    Blockly.Blocks['procedures_callnoreturn'] = {
        init: function (this: Blockly.Block & { parameters_?: string[] }) {
            this.appendDummyInput()
                .appendField('call')
                .appendField(new Blockly.FieldTextInput('함수이름'), 'NAME');
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(290);
            this.setTooltip('함수 호출 (리턴값 없음)');
            this.setHelpUrl('');
            this.parameters_ = [];
            (this as any).updateShape_();
        },
        mutationToDom: function (this: Blockly.Block & { parameters_?: string[] }): Element {
            const container = document.createElement('mutation');
            for (const param of this.parameters_ || []) {
                const paramElem = document.createElement('arg');
                paramElem.setAttribute('name', param);
                container.appendChild(paramElem);
            }
            return container;
        },
        domToMutation: function (this: Blockly.Block & { parameters_?: string[] }, xmlElement: Element): void {
            this.parameters_ = [];
            for (const child of Array.from(xmlElement.children)) {
                if (child.nodeName.toLowerCase() === 'arg') {
                    this.parameters_!.push(child.getAttribute('name') || '');
                }
            }
            (this as any).updateShape_();
        },
        updateShape_: function (this: Blockly.Block & { parameters_?: string[] }) {
            let i = 0;
            while (this.getInput('ARG' + i)) {
                this.removeInput('ARG' + i);
                i++;
            }
            for (let j = 0; j < (this.parameters_?.length || 0); j++) {
                this.appendValueInput('ARG' + j)
                    .setCheck(null)
                    .appendField(this.parameters_![j]);
            }
        },
        onchange: function (this: Blockly.Block & { parameters_?: string[] }) {
            if (!this.workspace) return;
            const funcName = this.getFieldValue('NAME');
            const blocks = this.workspace.getAllBlocks(false);
            for (const block of blocks) {
                if (block.type === 'ast_Summarized_FunctionDef' && block.getFieldValue('NAME') === funcName) {
                    const params = (block as any).parameters_ || [];
                    if (JSON.stringify(this.parameters_) !== JSON.stringify(params)) {
                        this.parameters_ = [...params];
                        (this as any).updateShape_();
                    }
                }
            }
        }
    };

    // Python Generator 등록 - pythonGenerator 인스턴스에 등록
    pythonGenerator.forBlock['ast_Summarized_FunctionDef'] = function (block: Blockly.Block, generator: any): string {
        try {
            // 새로운 함수 생성 시 변수명 캐시 초기화
            clearVariableNameCache();
            const funcName = block.getFieldValue('NAME') || 'unnamed_function';
            // 파라미터 수를 추적
            const paramCount = (block as any).parameterCount_ || 0;
            const paramList: string[] = [];

            for (let i = 0; i < paramCount; i++) {
                const paramBlock = block.getInputTargetBlock('PARAMETER' + i);
                if (paramBlock) {
                    const paramCode = generator.blockToCode(paramBlock);
                    // blockToCode() may return [code, order], so handle both
                    if (Array.isArray(paramCode)) {
                        paramList.push(paramCode[0]);
                    } else {
                        paramList.push(paramCode);
                    }
                }
            }

            const params = paramList.join(', ');
            // 함수 본문 블록을 처리
            const bodyCode = generator.statementToCode(block, 'BODY');
            

            
            // 들여쓰기 처리 개선 - 원본 들여쓰기 제거 후 새로 적용
            const indent = '    '; // Python 표준 4칸 공백
            let indentedBody = '';
            
            if (bodyCode && bodyCode.trim()) {
                // 본문 코드의 각 줄에 들여쓰기 적용
                const lines = bodyCode.split('\n');
                
                // 단순한 들여쓰기 처리: 원본 패턴 유지 + 함수 본문 4칸 시작
                const indentedLines: string[] = [];
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (line.trim() === '') {
                        indentedLines.push(line); // 빈 줄은 그대로
                        continue;
                    }
                    
                    const trimmedLine = line.trim();
                    
            // 원본 코드의 들여쓰기 패턴을 분석하여 적절한 레벨 결정
            let indentLevel = 1; // 기본 함수 본문 레벨 (4칸)
            
            // 현재 줄의 타입 확인
            const isIfElseStatement = trimmedLine.startsWith('if ') || trimmedLine.startsWith('elif ') || trimmedLine.startsWith('else:');
            const isWhileStatement = trimmedLine.startsWith('while ') || trimmedLine.startsWith('for ');
            const isGeneralCode = !isIfElseStatement && !isWhileStatement;
            
            if (isIfElseStatement) {
                // if/elif/else 문의 들여쓰기 레벨 결정
                // while 블록 안에 있는지 확인
                let isInWhileBlock = false;
                for (let j = i - 1; j >= 0; j--) {
                    const prevLine = lines[j].trim();
                    if (prevLine.startsWith('while ') || prevLine.startsWith('for ')) {
                        isInWhileBlock = true;
                        break;
                    }
                }
                
                if (isInWhileBlock) {
                    // while 블록 안의 if/elif/else는 12칸
                    indentLevel = 3;
                } else {
                    // 함수 본문 레벨의 if/elif/else는 4칸
                    indentLevel = 1;
                }
            } else if (isWhileStatement) {
                // while 문은 else 블록 안에 있으므로 8칸
                indentLevel = 2;
            } else {
                // 일반 코드의 경우 바로 이전 제어문을 찾아서 들여쓰기 결정
                let foundControlStatement = false;
                
                for (let j = i - 1; j >= 0 && !foundControlStatement; j--) {
                    const prevLine = lines[j].trim();
                    
                    if (prevLine.startsWith('if ') || prevLine.startsWith('elif ') || prevLine.startsWith('else:')) {
                        // if/elif/else 본문이므로 8칸
                        indentLevel = 2;
                        foundControlStatement = true;
                    } else if (prevLine.startsWith('while ') || prevLine.startsWith('for ')) {
                        // while/for 본문이므로 12칸
                        indentLevel = 3;
                        foundControlStatement = true;
                    }
                }
                
                // 특별한 경우: while 블록 안의 if 블록 안에 있는 코드
                // while과 if 둘 다 이전에 나타났는지 확인
                let hasWhile = false;
                let hasIf = false;
                
                for (let j = i - 1; j >= 0; j--) {
                    const prevLine = lines[j].trim();
                    if (prevLine.startsWith('while ') || prevLine.startsWith('for ')) {
                        hasWhile = true;
                    }
                    if (prevLine.startsWith('if ') && hasWhile) {
                        hasIf = true;
                        break;
                    }
                }
                
                // while 블록 안의 if 블록 안에 있는 코드는 16칸
                // 단, 마지막 return 문은 함수 레벨로 처리 (4칸)
                if (hasWhile && hasIf && !trimmedLine.startsWith('return result')) {
                    indentLevel = 4;
                } else if (trimmedLine.startsWith('return result')) {
                    // 함수의 마지막 return문은 함수 본문 레벨 (4칸)
                    indentLevel = 1;
                }
                
                // 기본값이 설정되지 않은 경우 함수 본문 레벨
                if (!foundControlStatement) {
                    indentLevel = 1;
                }
            }
                    
                    const currentIndent = '    '.repeat(indentLevel);
                    indentedLines.push(currentIndent + trimmedLine);
                }
                
                // 중복 return 문 제거
                const finalIndentedLines = indentedLines.filter((line, index) => {
                    if (line.trim().startsWith('return result')) {
                        // 첫 번째 return 문만 유지
                        const isFirstReturn = indentedLines.findIndex(l => l.trim().startsWith('return result')) === index;
                        return isFirstReturn;
                    }
                    return true;
                });
                
                indentedBody = finalIndentedLines.join('\n');
            } else {
                // 본문이 없는 경우 기본 pass 문 추가
                indentedBody = indent + 'pass\n';
            }
            
            const code = `def ${funcName}(${params}):\n${indentedBody}`;
            return code;
        } catch (error) {
            console.error('Error generating code for ast_Summarized_FunctionDef:', error);
            return 'def unnamed_function():\n    pass\n';
        }
    };

    // 기존 pythonGenerator에도 등록
    pythonGenerator.forBlock['ast_FunctionParameter'] = function (block: Blockly.Block, generator: any): [string, number] {
        const paramName = block.getFieldValue('NAME') || 'param';
        return [paramName, generator.ORDER_ATOMIC];
    };

    pythonGenerator.forBlock['ast_ReturnFull'] = function (block: Blockly.Block, generator: any): string {
        try {
            const bodyText = block.getFieldValue('TEXT') || '';
            const returnValue = generator.valueToCode(block, 'VALUE', generator.ORDER_NONE) || 'None';
            
            // 들여쓰기 처리 개선 - 원본 들여쓰기 제거 후 새로 적용
            const indent = '    '; // Python 표준 4칸 공백
            let indentedBody = '';
            
            if (bodyText && bodyText.trim()) {
                // 본문 텍스트의 각 줄에 들여쓰기 적용
                const lines = bodyText.trim().split('\n');
                const indentedLines = lines.map((line: string) => {
                    if (line.trim() === '') return line; // 빈 줄은 그대로
                    // 원본 들여쓰기 제거 후 새로 적용
                    const trimmedLine = line.trim();
                    return indent + trimmedLine; // 각 줄에 4칸 들여쓰기 추가
                });
                indentedBody = indentedLines.join('\n') + '\n';
            }
            
            const returnLine = indent + `return ${returnValue}\n`;
            return indentedBody + returnLine;
        } catch (error) {
            console.error('Error generating code for ast_ReturnFull:', error);
            return '    return None\n';
        }
    };

    pythonGenerator.forBlock['ast_Name'] = function (block: Blockly.Block, generator: any): [string, number] {
        const varName = block.getFieldValue('VAR') || 'var';
        return [varName, generator.ORDER_ATOMIC];
    };

    // 기본 변수 블록들 추가
    pythonGenerator.forBlock['variables_set'] = function (block: Blockly.Block, generator: any): string {
        const varName = sanitizeVariableName(block.getFieldValue('VAR'));
        const value = generator.valueToCode(block, 'VALUE', generator.ORDER_NONE) || 'None';
        return `${varName} = ${value}\n`;
    };

    pythonGenerator.forBlock['variables_get'] = function (block: Blockly.Block, generator: any): [string, number] {
        const varName = sanitizeVariableName(block.getFieldValue('VAR'));
        return [varName, generator.ORDER_ATOMIC];
    };

    // 누락된 Python Generator들 추가 (forBlock 방식으로 수정)
    pythonGenerator.forBlock['math_number'] = function (block: Blockly.Block, generator: any): [string, number] {
        const num = block.getFieldValue('NUM');
        return [num, generator.ORDER_ATOMIC];
    };

    pythonGenerator.forBlock['lists_create_with'] = function (block: Blockly.Block, generator: any): [string, number] {
        const elements: string[] = [];
        for (let i = 0; i < (block as any).itemCount_; i++) {
            const paramCode = generator.valueToCode(block, 'ADD' + i, generator.ORDER_NONE) || 'None';
            elements.push(paramCode);
        }
        const code = `[${elements.join(', ')}]`;
        return [code, generator.ORDER_ATOMIC];
    };

    pythonGenerator.forBlock['text'] = function (block: Blockly.Block, generator: any): [string, number] {
        const text = block.getFieldValue('TEXT');
        const code = (generator as any).quote_(text);
        return [code, generator.ORDER_ATOMIC];
    };

    // 텍스트 출력 블록 추가
    pythonGenerator.forBlock['text_print'] = function (block: Blockly.Block, generator: any): string {
        const value = generator.valueToCode(block, 'TEXT', generator.ORDER_NONE) || '""';
        return `print(${value})\n`;
    };

    // 텍스트 조작 블록들 추가
    pythonGenerator.forBlock['text_join'] = function (block: Blockly.Block, generator: any): [string, number] {
        const elements: string[] = [];
        for (let i = 0; i < (block as any).itemCount_; i++) {
            const value = generator.valueToCode(block, 'ADD' + i, generator.ORDER_NONE) || '""';
            elements.push(value);
        }
        const code = elements.join(' + ');
        return [code, generator.ORDER_ADDITIVE];
    };

    pythonGenerator.forBlock['text_length'] = function (block: Blockly.Block, generator: any): [string, number] {
        const text = generator.valueToCode(block, 'VALUE', generator.ORDER_NONE) || '""';
        const code = `len(${text})`;
        return [code, generator.ORDER_FUNCTION_CALL];
    };

    pythonGenerator.forBlock['text_isEmpty'] = function (block: Blockly.Block, generator: any): [string, number] {
        const text = generator.valueToCode(block, 'VALUE', generator.ORDER_NONE) || '""';
        const code = `len(${text}) == 0`;
        return [code, generator.ORDER_RELATIONAL];
    };

    // 논리 블록들 추가
    pythonGenerator.forBlock['logic_boolean'] = function (block: Blockly.Block, generator: any): [string, number] {
        const code = (block.getFieldValue('BOOL') === 'TRUE') ? 'True' : 'False';
        return [code, generator.ORDER_ATOMIC];
    };

    pythonGenerator.forBlock['logic_compare'] = function (block: Blockly.Block, generator: any): [string, number] {
        const OPERATORS: { [key: string]: string } = {
            'EQ': '==',
            'NEQ': '!=',
            'LT': '<',
            'LTE': '<=',
            'GT': '>',
            'GTE': '>='
        };
        const operator = OPERATORS[block.getFieldValue('OP')] || '==';
        const left = generator.valueToCode(block, 'A', generator.ORDER_RELATIONAL) || '0';
        const right = generator.valueToCode(block, 'B', generator.ORDER_RELATIONAL) || '0';
        const code = `${left} ${operator} ${right}`;
        return [code, generator.ORDER_RELATIONAL];
    };

    pythonGenerator.forBlock['logic_operation'] = function (block: Blockly.Block, generator: any): [string, number] {
        const operator = (block.getFieldValue('OP') === 'AND') ? 'and' : 'or';
        const left = generator.valueToCode(block, 'A', generator.ORDER_LOGICAL_AND) || 'False';
        const right = generator.valueToCode(block, 'B', generator.ORDER_LOGICAL_AND) || 'False';
        const code = `${left} ${operator} ${right}`;
        return [code, generator.ORDER_LOGICAL_AND];
    };

    pythonGenerator.forBlock['logic_negate'] = function (block: Blockly.Block, generator: any): [string, number] {
        const value = generator.valueToCode(block, 'BOOL', generator.ORDER_LOGICAL_NOT) || 'False';
        const code = `not ${value}`;
        return [code, generator.ORDER_LOGICAL_NOT];
    };

    // 수학 연산 블록들 추가
    pythonGenerator.forBlock['math_arithmetic'] = function (block: Blockly.Block, generator: any): [string, number] {
        const OPERATORS: { [key: string]: [string, number] } = {
            'ADD': [' + ', generator.ORDER_ADDITIVE],
            'MINUS': [' - ', generator.ORDER_ADDITIVE],
            'MULTIPLY': [' * ', generator.ORDER_MULTIPLICATIVE],
            'DIVIDE': [' / ', generator.ORDER_MULTIPLICATIVE],
            'POWER': [' ** ', generator.ORDER_EXPONENTIATION]
        };
        const tuple = OPERATORS[block.getFieldValue('OP')] || [' + ', generator.ORDER_ADDITIVE];
        const operator = tuple[0];
        const order = tuple[1];
        const left = generator.valueToCode(block, 'A', order) || '0';
        const right = generator.valueToCode(block, 'B', order) || '0';
        const code = `${left}${operator}${right}`;
        return [code, order];
    };

    // 제어문 블록들 추가
    pythonGenerator.forBlock['controls_if'] = function (block: Blockly.Block, generator: any): string {
        let code = '';
        const conditionCode = generator.valueToCode(block, 'IF0', generator.ORDER_NONE) || 'False';
        const branchCode = generator.statementToCode(block, 'DO0') || '    pass\n';
        code += `if ${conditionCode}:\n${branchCode}`;
        
        // elif 블록들 처리
        for (let i = 1; i <= (block as any).elseifCount_; i++) {
            const elseifCondition = generator.valueToCode(block, 'IF' + i, generator.ORDER_NONE) || 'False';
            const elseifBranch = generator.statementToCode(block, 'DO' + i) || '    pass\n';
            code += `elif ${elseifCondition}:\n${elseifBranch}`;
        }
        
        // else 블록 처리
        if ((block as any).elseCount_) {
            const elseBranch = generator.statementToCode(block, 'ELSE') || '    pass\n';
            code += `else:\n${elseBranch}`;
        }
        
        return code;
    };

    pythonGenerator.forBlock['controls_whileUntil'] = function (block: Blockly.Block, generator: any): string {
        const until = block.getFieldValue('MODE') === 'UNTIL';
        const condition = generator.valueToCode(block, 'BOOL', generator.ORDER_NONE) || 'False';
        const branch = generator.statementToCode(block, 'DO') || '    pass\n';
        
        if (until) {
            return `while not ${condition}:\n${branch}`;
        } else {
            return `while ${condition}:\n${branch}`;
        }
    };

    // 반복문 블록들 추가
    pythonGenerator.forBlock['controls_for'] = function (block: Blockly.Block, generator: any): string {
        const variable = sanitizeVariableName(block.getFieldValue('VAR') || 'i');
        const from = generator.valueToCode(block, 'FROM', generator.ORDER_NONE) || '0';
        const to = generator.valueToCode(block, 'TO', generator.ORDER_NONE) || '0';
        const by = generator.valueToCode(block, 'BY', generator.ORDER_NONE) || '1';
        const branch = generator.statementToCode(block, 'DO') || '    pass\n';
        
        let code = '';
        if (by === '1') {
            code = `for ${variable} in range(${from}, ${to} + 1):\n${branch}`;
        } else {
            code = `for ${variable} in range(${from}, ${to} + 1, ${by}):\n${branch}`;
        }
        return code;
    };

    pythonGenerator.forBlock['controls_forEach'] = function (block: Blockly.Block, generator: any): string {
        const variable = sanitizeVariableName(block.getFieldValue('VAR') || 'item');
        const list = generator.valueToCode(block, 'LIST', generator.ORDER_NONE) || '[]';
        const branch = generator.statementToCode(block, 'DO') || '    pass\n';
        return `for ${variable} in ${list}:\n${branch}`;
    };

    pythonGenerator.forBlock['controls_repeat_ext'] = function (block: Blockly.Block, generator: any): string {
        const times = generator.valueToCode(block, 'TIMES', generator.ORDER_NONE) || '0';
        const branch = generator.statementToCode(block, 'DO') || '    pass\n';
        return `for _ in range(${times}):\n${branch}`;
    };

    // 리스트 블록들 추가
    pythonGenerator.forBlock['lists_length'] = function (block: Blockly.Block, generator: any): [string, number] {
        const list = generator.valueToCode(block, 'VALUE', generator.ORDER_NONE) || '[]';
        const code = `len(${list})`;
        return [code, generator.ORDER_FUNCTION_CALL];
    };

    pythonGenerator.forBlock['lists_isEmpty'] = function (block: Blockly.Block, generator: any): [string, number] {
        const list = generator.valueToCode(block, 'VALUE', generator.ORDER_NONE) || '[]';
        const code = `len(${list}) == 0`;
        return [code, generator.ORDER_RELATIONAL];
    };

    pythonGenerator.forBlock['lists_getIndex'] = function (block: Blockly.Block, generator: any): [string, number] {
        const mode = block.getFieldValue('MODE') || 'GET';
        const where = block.getFieldValue('WHERE') || 'FROM_START';
        const list = generator.valueToCode(block, 'VALUE', generator.ORDER_NONE) || '[]';
        
        let index = '';
        if (where === 'FROM_START') {
            index = generator.valueToCode(block, 'AT', generator.ORDER_NONE) || '0';
        } else if (where === 'FROM_END') {
            index = `-(${generator.valueToCode(block, 'AT', generator.ORDER_NONE) || '1'})`;
        } else if (where === 'FIRST') {
            index = '0';
        } else if (where === 'LAST') {
            index = '-1';
        } else if (where === 'RANDOM') {
            index = `random.randint(0, len(${list}) - 1)`;
        }
        
        const code = `${list}[${index}]`;
        return [code, generator.ORDER_MEMBER];
    };

    pythonGenerator.forBlock['lists_setIndex'] = function (block: Blockly.Block, generator: any): string {
        const mode = block.getFieldValue('MODE') || 'SET';
        const where = block.getFieldValue('WHERE') || 'FROM_START';
        const list = generator.valueToCode(block, 'LIST', generator.ORDER_NONE) || '[]';
        const value = generator.valueToCode(block, 'TO', generator.ORDER_NONE) || 'None';
        
        let index = '';
        if (where === 'FROM_START') {
            index = generator.valueToCode(block, 'AT', generator.ORDER_NONE) || '0';
        } else if (where === 'FROM_END') {
            index = `-(${generator.valueToCode(block, 'AT', generator.ORDER_NONE) || '1'})`;
        } else if (where === 'FIRST') {
            index = '0';
        } else if (where === 'LAST') {
            index = '-1';
        } else if (where === 'RANDOM') {
            index = `random.randint(0, len(${list}) - 1)`;
        }
        
        return `${list}[${index}] = ${value}\n`;
    };

    // 기본 함수 블록들 추가 (forBlock 방식으로 수정)
    pythonGenerator.forBlock['procedures_defreturn'] = function (block: Blockly.Block, generator: any): string {
        const functionName = block.getFieldValue('NAME') || 'unnamed';
        const args = (block as any).getVars ? (block as any).getVars() : [];
        const argsCode = args.join(', ');
        const statements = generator.statementToCode(block, 'STACK');
        
        // 들여쓰기 처리 개선 - 원본 들여쓰기 제거 후 새로 적용
        const indent = '    '; // Python 표준 4칸 공백
        let indentedStatements = '';
        
        if (statements && statements.trim()) {
            // 본문 코드의 각 줄에 들여쓰기 적용
            const lines = statements.split('\n');
            const indentedLines = lines.map((line: string) => {
                if (line.trim() === '') return line; // 빈 줄은 그대로
                // 원본 들여쓰기 제거 후 새로 적용
                const trimmedLine = line.trim();
                return indent + trimmedLine; // 각 줄에 4칸 들여쓰기 추가
            });
            indentedStatements = indentedLines.join('\n');
        }
        
        const returnValue = generator.valueToCode(block, 'RETURN', generator.ORDER_NONE) || 'None';
        const indentedReturn = `${indent}return ${returnValue}\n`;
        return `def ${functionName}(${argsCode}):\n${indentedStatements}${indentedReturn}`;
    };

    // custom_block.js에 있는 procedures_callreturn과 procedures_callnoreturn 추가
    pythonGenerator.forBlock['procedures_callreturn'] = function (block: Blockly.Block, generator: any): [string, number] {
        const functionName = block.getFieldValue('NAME') || 'unnamed';
        const args: string[] = [];

        // arg count는 mutation이 저장하고 있음
        const argCount = block.inputList.filter((input: any) => input.name?.startsWith('ARG')).length;

        for (let i = 0; i < argCount; i++) {
            const argCode = generator.valueToCode(block, 'ARG' + i, generator.ORDER_NONE) || 'None';
            args.push(argCode);
        }

        const code = `${functionName}(${args.join(', ')})`;
        return [code, generator.ORDER_FUNCTION_CALL];
    };

    pythonGenerator.forBlock['procedures_callnoreturn'] = function (block: Blockly.Block, generator: any): string {
        const funcName = block.getFieldValue('NAME');
        const args: string[] = [];

        for (let i = 0; i < (block as any).argumentCount_; i++) {
            const argCode = generator.valueToCode(block, 'ARG' + i, generator.ORDER_NONE) || 'None';
            args.push(argCode);
        }

        return `${funcName}(${args.join(', ')})\n`;
    };

    // Mutator 믹스인 객체 분리 (custom_block.js와 동일하게 수정)
    const PARAMS_MUTATOR_MIXIN = {
        parameterCount_: 0,

        mutationToDom: function (this: any) {
            const container = document.createElement('mutation');
            container.setAttribute('parameters', this.parameterCount_);
            return container;
        },

        domToMutation: function (this: any, xmlElement: Element) {
            this.parameterCount_ = parseInt(xmlElement.getAttribute('parameters') || '0', 10);
            this.updateShape_();
        },

        decompose: function (this: any, workspace: Blockly.Workspace) {
            const containerBlock = workspace.newBlock('parameters_container');
            (containerBlock as any).initSvg();
            let connection = (containerBlock as any).getInput('STACK').connection;
            for (let i = 0; i < this.parameterCount_; i++) {
                const paramBlock = workspace.newBlock('ast_FunctionParameter');
                (paramBlock as any).initSvg();
                connection.connect((paramBlock as any).previousConnection);
                connection = (paramBlock as any).nextConnection;
            }
            return containerBlock;
        },

        compose: function (this: any, containerBlock: Blockly.Block) {
            let itemBlock = (containerBlock as any).getInputTargetBlock('STACK');
            const parameters: any[] = [];
            while (itemBlock) {
                parameters.push(itemBlock);
                itemBlock = (itemBlock as any).nextConnection && (itemBlock as any).nextConnection.targetBlock();
            }
            this.parameterCount_ = parameters.length;
            this.updateShape_();
        },

        updateShape_: function (this: any) {
            // Clear previous inputs
            let i = 0;
            while (this.getInput('PARAMETER' + i)) {
                this.removeInput('PARAMETER' + i);
                i++;
            }
            // Add new inputs
            for (let j = 0; j < this.parameterCount_; j++) {
                this.appendValueInput('PARAMETER' + j)
                    .setCheck(null)
                    .appendField('param');
            }
        }
    };

    // Blockly.Extensions.registerMutator 호출 (주석 처리된 상태로 유지)
    // Blockly.Extensions.registerMutator(
    //     'parameters_mutator',
    //     PARAMS_MUTATOR_MIXIN,
    //     null, // No helper function needed if we embed updateShape_
    //     ['ast_FunctionParameter']
    // );

    // 등록 완료
    console.log("Summary blocks registered successfully");
}

export { pythonGenerator }; 