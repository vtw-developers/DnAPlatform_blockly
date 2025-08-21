import Blockly from 'blockly/core';
import JavaScript from 'blockly/javascript';
import { PythonGenerator } from 'blockly/python';

// 인스턴스 생성
const pythonGenerator = new PythonGenerator();

// 들여쓰기 상수 설정 (Python 표준 4칸 공백)
pythonGenerator.INDENT = '    ';

// 들여쓰기 관련 상수들
const INDENT_CONFIG = {
    BASE_INDENT: '    ', // 기본 4칸 공백
    FUNCTION_BODY_LEVEL: 1, // 함수 본문 레벨
    IF_ELSE_BODY_LEVEL: 2, // if/else 본문 레벨  
    WHILE_FOR_BODY_LEVEL: 3, // while/for 본문 레벨
    NESTED_CONTROL_LEVEL: 4, // 중첩된 제어문 레벨
} as const;

// 들여쓰기 유틸리티 함수들
function getIndentString(level: number): string {
    return INDENT_CONFIG.BASE_INDENT.repeat(level);
}

function calculateIndentLevel(
    trimmedLine: string, 
    previousLines: string[], 
    currentIndex: number
): number {
    // 독스트링이나 함수 문서화는 함수 본문 레벨
    if (trimmedLine.startsWith('"""') || trimmedLine.startsWith(':param') || trimmedLine.startsWith(':return')) {
        return INDENT_CONFIG.FUNCTION_BODY_LEVEL;
    }
    
    // 제어문 타입 확인
    const isIfElseStatement = trimmedLine.startsWith('if ') || trimmedLine.startsWith('elif ') || trimmedLine.startsWith('else:');
    const isWhileStatement = trimmedLine.startsWith('while ') || trimmedLine.startsWith('for ');
    
    // 이전 줄들을 역순으로 확인하여 현재 컨텍스트 파악
    let hasWhile = false;
    let hasIf = false;
    
    for (let i = currentIndex - 1; i >= 0; i--) {
        const prevTrimmed = previousLines[i].trim();
        if (prevTrimmed.startsWith('while ') || prevTrimmed.startsWith('for ')) {
            hasWhile = true;
        }
        if (prevTrimmed.startsWith('if ') || prevTrimmed.startsWith('elif ')) {
            hasIf = true;
        }
    }
    
    // return 문 특별 처리
    if (trimmedLine.startsWith('return result')) {
        return INDENT_CONFIG.FUNCTION_BODY_LEVEL;
    }
    
    // 들여쓰기 레벨 결정 로직
    if (isIfElseStatement) {
        return hasWhile ? INDENT_CONFIG.WHILE_FOR_BODY_LEVEL : INDENT_CONFIG.FUNCTION_BODY_LEVEL;
    } else if (isWhileStatement) {
        return INDENT_CONFIG.IF_ELSE_BODY_LEVEL;
    } else {
        // 일반 코드의 경우 컨텍스트에 따라 결정
        if (hasWhile && hasIf) {
            return INDENT_CONFIG.NESTED_CONTROL_LEVEL;
        } else if (hasWhile || hasIf) {
            return INDENT_CONFIG.IF_ELSE_BODY_LEVEL;
        } else {
            return INDENT_CONFIG.FUNCTION_BODY_LEVEL;
        }
    }
}

function isHighIndentReturnStatement(line: string): boolean {
    const trimmed = line.trim();
    return trimmed === 'return result' && line.startsWith(getIndentString(2)); // 8칸 이상 들여쓰기
}

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
                .appendField(new Blockly.FieldTextInput('함수이름'), 'NAME')
                .appendField('with:');
            this.setOutput(true, null);
            this.setColour(290);
            this.setTooltip('함수 호출 (리턴값 있음)');
            this.setHelpUrl('');
            this.parameters_ = [];
            (this as any).updateShape_();
        },
        mutationToDom: function (this: Blockly.Block & { parameters_?: string[] }): Element {
            const container = document.createElement('mutation');
            // 함수명도 mutation에 저장
            const functionName = this.getFieldValue('NAME');
            if (functionName) {
                container.setAttribute('name', functionName);
            }
            for (const param of this.parameters_ || []) {
                const paramElem = document.createElement('arg');
                paramElem.setAttribute('name', param);
                container.appendChild(paramElem);
            }
            return container;
        },
        domToMutation: function (this: Blockly.Block & { parameters_?: string[] }, xmlElement: Element): void {
            // mutation에서 함수명 읽어오기
            const functionName = xmlElement.getAttribute('name');
            if (functionName) {
                this.setFieldValue(functionName, 'NAME');
            }
            
            this.parameters_ = [];
            for (const child of Array.from(xmlElement.children)) {
                if (child.nodeName.toLowerCase() === 'arg') {
                    this.parameters_!.push(child.getAttribute('name') || '');
                }
            }
            console.log('procedures_callreturn domToMutation - parameters_:', this.parameters_);
            (this as any).updateShape_();
        },
        updateShape_: function (this: Blockly.Block & { parameters_?: string[] }) {
            console.log('procedures_callreturn updateShape_ - parameters_:', this.parameters_);
            let i = 0;
            while (this.getInput('ARG' + i)) {
                this.removeInput('ARG' + i);
                i++;
            }
            for (let j = 0; j < (this.parameters_?.length || 0); j++) {
                console.log(`Adding parameter ${j}: ${this.parameters_![j]}`);
                this.appendValueInput('ARG' + j)
                    .setCheck(null)
                    .appendField(this.parameters_![j] || `param${j + 1}`);
            }
        },
        onchange: function (this: Blockly.Block & { parameters_?: string[] }) {
            // XML에서 로드된 파라미터를 유지하기 위해 자동 동기화 비활성화
            console.log('onchange called - skipping auto sync to preserve XML parameters');
            return;
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
            // 함수명도 mutation에 저장
            const functionName = this.getFieldValue('NAME');
            if (functionName) {
                container.setAttribute('name', functionName);
            }
            for (const param of this.parameters_ || []) {
                const paramElem = document.createElement('arg');
                paramElem.setAttribute('name', param);
                container.appendChild(paramElem);
            }
            return container;
        },
        domToMutation: function (this: Blockly.Block & { parameters_?: string[] }, xmlElement: Element): void {
            // mutation에서 함수명 읽어오기
            const functionName = xmlElement.getAttribute('name');
            if (functionName) {
                this.setFieldValue(functionName, 'NAME');
            }
            
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
                    .appendField(this.parameters_![j] || `param${j + 1}`);
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
            let indentedBody = '';
            
            if (bodyCode && bodyCode.trim()) {
                // 본문 코드의 각 줄에 들여쓰기 적용
                const lines = bodyCode.split('\n');
                const indentedLines: string[] = [];
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (line.trim() === '') {
                        indentedLines.push(line); // 빈 줄은 그대로
                        continue;
                    }
                    
                    const trimmedLine = line.trim();
                    
                    // 새로운 유틸리티 함수를 사용하여 들여쓰기 레벨 계산
                    const indentLevel = calculateIndentLevel(trimmedLine, lines, i);
                    
                    // 이미 들여쓰기가 적용된 줄인지 확인
                    if (line.startsWith('    ')) {
                        // 이미 들여쓰기가 있으면 그대로 사용
                        indentedLines.push(line);
                    } else {
                        // 들여쓰기가 없는 줄만 새로 적용
                        const indentString = getIndentString(indentLevel);
                        indentedLines.push(indentString + trimmedLine);
                    }
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
                indentedBody = getIndentString(INDENT_CONFIG.FUNCTION_BODY_LEVEL) + 'pass\n';
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
            
            // 들여쓰기 처리
            let indentedBody = '';
            
            if (bodyText && bodyText.trim()) {
                // 본문 텍스트의 각 줄에 들여쓰기 적용
                const lines = bodyText.trim().split('\n');
                const indentedLines: string[] = [];
                
                // Python 구문 기반 들여쓰기 처리
                let currentIndentLevel = INDENT_CONFIG.FUNCTION_BODY_LEVEL; // 함수 본문 시작 레벨
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (line.trim() === '') continue; // 빈 줄은 건너뛰기
                    
                    const trimmedLine = line.trim();
                    let indentLevel = currentIndentLevel;
                    
                    // Python 구문에 따른 들여쓰기 레벨 결정
                    if (trimmedLine.startsWith('"""') || trimmedLine.startsWith(':param') || trimmedLine.startsWith(':return')) {
                        // 독스트링: 함수 본문 레벨
                        indentLevel = INDENT_CONFIG.FUNCTION_BODY_LEVEL;
                    } else if (trimmedLine.startsWith('elif ') || trimmedLine.startsWith('else:')) {
                        // elif, else: if와 같은 레벨 (현재 레벨 - 1)
                        indentLevel = currentIndentLevel - 1;
                        // 다음 줄부터 한 레벨 증가 (블록 내부)
                        currentIndentLevel = indentLevel + 1;
                    } else if (trimmedLine.endsWith(':')) {
                        // 블록 시작 (if, for, while): 현재 레벨
                        indentLevel = currentIndentLevel;
                        // 다음 줄부터 한 레벨 증가
                        currentIndentLevel++;
                    } else {
                        // 일반 문장: 현재 레벨
                        indentLevel = currentIndentLevel;
                    }
                    
                    const indentString = getIndentString(indentLevel);
                    indentedLines.push(indentString + trimmedLine);
                }
                
                // 불필요한 코드 제거: if 블록 안의 return result만 제거 (초기화는 유지)
                const filteredLines = indentedLines.filter((line, index) => {
                    const trimmed = line.trim();
                    
                    // if 블록 안의 return result 제거 (높은 들여쓰기 레벨의 return result)
                    if (isHighIndentReturnStatement(line)) {
                        return false;
                    }
                    // 마지막 return result도 제거 (함수 끝에 새로 추가할 예정)
                    if (trimmed === 'return result' && index === indentedLines.length - 1) {
                        return false;
                    }
                    
                    // 나머지는 모두 유지 (result = '' 초기화 포함)
                    return true;
                });
                
                indentedBody = filteredLines.join('\n') + '\n';
            }
            
            // 항상 마지막에 return 문 추가 (마지막 return은 이미 필터링에서 제거됨)
            const returnLine = getIndentString(INDENT_CONFIG.FUNCTION_BODY_LEVEL) + `return ${returnValue}\n`;
            const finalCode = indentedBody + returnLine;
            return finalCode;
        } catch (error) {
            console.error('Error generating code for ast_ReturnFull:', error);
            return '    return None\n';
        }
    };

    pythonGenerator.forBlock['ast_Name'] = function (block: Blockly.Block, generator: any): [string, number] {
        const varName = block.getFieldValue('VAR') || 'var';
        return [varName, generator.ORDER_ATOMIC];
    };

    // 기본 블록들은 Blockly 기본 Python 생성기 사용
    // 커스텀 블록들만 여기서 정의

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