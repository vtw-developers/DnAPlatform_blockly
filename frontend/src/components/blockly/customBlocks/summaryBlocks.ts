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
} as const;

// 들여쓰기 유틸리티 함수들
function getIndentString(level: number): string {
    return INDENT_CONFIG.BASE_INDENT.repeat(level);
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



// Blockly.Block 인터페이스 확장
interface ExtendedBlock extends Blockly.Block {
    parameterCount_?: number;
    updateShape_?: () => void;
    parameters_?: string[];
    decompose?: (workspace: Blockly.Workspace) => Blockly.Block;
    compose?: (containerBlock: Blockly.Block) => void;
    loadPythonCodeFromXml?: () => void;
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
            // 숨겨진 논리적 수식 저장 필드 추가 (원본 Python 코드 보존용)
            this.appendDummyInput('HIDDEN_LOGIC')
                .appendField(new Blockly.FieldTextInput(''), 'LOGIC_TEXT')
                .setVisible(false);
            // Body 영역 블록 연결을 위해 정의
            this.appendStatementInput('BODY')
                .setCheck(null)
                .appendField('Body');
        },
        mutationToDom: function (this: ExtendedBlock): Element {
            const container = document.createElement('mutation');
            container.setAttribute('parameters', this.parameterCount_?.toString() || '0');
            // 논리적 수식도 mutation에 저장
            const logicText = this.getFieldValue('LOGIC_TEXT') || '';
            if (logicText) {
                container.setAttribute('logic', logicText);
            }
            return container;
        },
        domToMutation: function (this: ExtendedBlock, xmlElement: Element): void {
            const paramCount = parseInt(xmlElement.getAttribute('parameters') || '0', 10);
            this.parameterCount_ = paramCount;
            

            
            // XML에서 Python 코드를 찾아서 LOGIC_TEXT에 저장
            // BODY 블록의 TEXT 필드에서 Python 코드 추출
            const bodyBlock = xmlElement.querySelector('statement[name="BODY"] block');
            
            if (bodyBlock) {
                // ast_ReturnFull 블록의 TEXT 필드에서 Python 코드 추출
                const returnBlock = bodyBlock.querySelector('block[type="ast_ReturnFull"]');
                
                if (returnBlock) {
                    const textField = returnBlock.querySelector('field[name="TEXT"]');
                    
                    if (textField && textField.textContent) {
                        // 원본 Python 코드를 LOGIC_TEXT에 저장하여 들여쓰기 보존
                        const pythonCode = textField.textContent;
                        this.setFieldValue(pythonCode, 'LOGIC_TEXT');
                    }
                }
            }
            
            // mutation에서 논리적 수식 복원 (기존 로직 유지)
            // 단, TEXT 필드에서 읽어온 Python 코드가 있으면 그것을 우선시
            const logicText = xmlElement.getAttribute('logic') || '';
            if (logicText && !this.getFieldValue('LOGIC_TEXT')) {
                // LOGIC_TEXT에 아무것도 없을 때만 mutation의 logic 사용
                this.setFieldValue(logicText, 'LOGIC_TEXT');
            }
            
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
        },
        
        // XML에서 Python 코드를 읽어오는 함수
        loadPythonCodeFromXml: function (this: ExtendedBlock) {
            try {
                // BODY 입력에서 직접 ast_ReturnFull 블록 찾기
                const bodyInput = this.getInput('BODY');
                if (bodyInput && bodyInput.connection) {
                    const connectedBlock = bodyInput.connection.targetBlock();
                    if (connectedBlock && connectedBlock.type === 'ast_ReturnFull') {
                        // ast_ReturnFull 블록의 TEXT 필드에서 Python 코드 읽기
                        const textField = connectedBlock.getField('TEXT');
                        if (textField) {
                            const pythonCode = textField.getValue();
                            this.setFieldValue(pythonCode, 'LOGIC_TEXT');
                        }
                    }
                }
            } catch (error) {
                // BODY에서 Python 코드 읽기 실패 시 무시
            }
        },
        

        
        // XML 로드 후 Python 코드를 읽어오는 이벤트
        onchange: function (this: ExtendedBlock) {
            // XML 로드가 완료된 후 Python 코드 읽기
            setTimeout(() => {
                if (this.loadPythonCodeFromXml) {
                    this.loadPythonCodeFromXml();
                }
            }, 100);
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

    // 파라미터 추가/제거를 위한 mutator 컨테이너 블록
    Blockly.Blocks['call_parameters_container'] = {
        init: function (this: Blockly.Block) {
            this.appendDummyInput().appendField('파라미터 설정');
            this.appendStatementInput('STACK');
            this.setColour(290);
            this.setTooltip('파라미터를 추가하거나 제거하세요');
            this.contextMenu = false;
        }
    };

    // 개별 파라미터 아이템 블록
    Blockly.Blocks['call_parameter_item'] = {
        init: function (this: Blockly.Block) {
            this.appendDummyInput()
                .appendField('파라미터:')
                .appendField(new Blockly.FieldTextInput('x'), 'PARAM_NAME');
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(260);
            this.setTooltip('함수 호출 파라미터');
            this.contextMenu = false;
        }
    };

    // 함수 호출 블록 (파라미터 동적 추가/제거 가능)
    Blockly.Blocks['procedures_callreturn'] = {
        init: function (this: ExtendedBlock) {
            this.appendDummyInput()
                .appendField(new Blockly.FieldTextInput('함수이름'), 'NAME')
                .appendField('with:');
            this.setOutput(true, null);
            this.setColour(290);
            this.setTooltip('함수 호출 (리턴값 있음) - 설정 버튼으로 파라미터 추가/제거 가능');
            this.setHelpUrl('');
            this.parameters_ = [];
            this.setMutator(new Blockly.icons.MutatorIcon(['call_parameter_item'], this as any));
            (this as any).updateShape_();
        },
        mutationToDom: function (this: ExtendedBlock): Element {
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
        domToMutation: function (this: ExtendedBlock, xmlElement: Element): void {
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
        // mutator 분해 - 설정 팝업에서 보여줄 파라미터 블록들 생성
        decompose: function (this: ExtendedBlock, workspace: Blockly.Workspace): Blockly.Block {
            const containerBlock = workspace.newBlock('call_parameters_container') as any;
            containerBlock.initSvg();
            let connection = containerBlock.getInput('STACK')!.connection;
            
            for (let i = 0; i < (this.parameters_?.length || 0); i++) {
                const paramBlock = workspace.newBlock('call_parameter_item') as any;
                paramBlock.initSvg();
                paramBlock.setFieldValue(this.parameters_![i] || `param${i + 1}`, 'PARAM_NAME');
                connection!.connect(paramBlock.previousConnection!);
                connection = paramBlock.nextConnection;
            }
            return containerBlock;
        },
        
        // mutator 조합 - 설정 팝업에서 확인 버튼 눌렀을 때 파라미터 적용
        compose: function (this: ExtendedBlock, containerBlock: Blockly.Block): void {
            let itemBlock = containerBlock.getInputTargetBlock('STACK');
            const newParameters: string[] = [];
            
            // 연결된 파라미터 아이템들을 순회하며 파라미터명 수집
            while (itemBlock) {
                if (itemBlock.type === 'call_parameter_item') {
                    const paramName = itemBlock.getFieldValue('PARAM_NAME') || `param${newParameters.length + 1}`;
                    newParameters.push(paramName);
                }
                itemBlock = itemBlock.nextConnection?.targetBlock() || null;
            }
            
            this.parameters_ = newParameters;
            this.updateShape_!();
        },
        
        updateShape_: function (this: ExtendedBlock) {
            // 기존 파라미터 입력 제거
            let i = 0;
            while (this.getInput('ARG' + i)) {
                this.removeInput('ARG' + i);
                i++;
            }
            
            // 새 파라미터 입력 추가
            for (let j = 0; j < (this.parameters_?.length || 0); j++) {
                this.appendValueInput('ARG' + j)
                    .setCheck(null)
                    .appendField(this.parameters_![j] || `param${j + 1}`);
            }
        },
        onchange: function (this: ExtendedBlock) {
            // XML에서 로드된 파라미터를 유지하기 위해 자동 동기화 비활성화
            return;
        }
    };

    // 함수 호출 블록 (리턴값 없음, 파라미터 동적 추가/제거 가능)
    Blockly.Blocks['procedures_callnoreturn'] = {
        init: function (this: ExtendedBlock) {
            this.appendDummyInput()
                .appendField('call')
                .appendField(new Blockly.FieldTextInput('함수이름'), 'NAME');
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(290);
            this.setTooltip('함수 호출 (리턴값 없음) - 설정 버튼으로 파라미터 추가/제거 가능');
            this.setHelpUrl('');
            this.parameters_ = [];
            this.setMutator(new Blockly.icons.MutatorIcon(['call_parameter_item'], this as any));
            (this as any).updateShape_();
        },
        mutationToDom: function (this: ExtendedBlock): Element {
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
        domToMutation: function (this: ExtendedBlock, xmlElement: Element): void {
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
        // mutator 분해 - 설정 팝업에서 보여줄 파라미터 블록들 생성
        decompose: function (this: ExtendedBlock, workspace: Blockly.Workspace): Blockly.Block {
            const containerBlock = workspace.newBlock('call_parameters_container') as any;
            containerBlock.initSvg();
            let connection = containerBlock.getInput('STACK')!.connection;
            
            for (let i = 0; i < (this.parameters_?.length || 0); i++) {
                const paramBlock = workspace.newBlock('call_parameter_item') as any;
                paramBlock.initSvg();
                paramBlock.setFieldValue(this.parameters_![i] || `param${i + 1}`, 'PARAM_NAME');
                connection!.connect(paramBlock.previousConnection!);
                connection = paramBlock.nextConnection;
            }
            return containerBlock;
        },
        
        // mutator 조합 - 설정 팝업에서 확인 버튼 눌렀을 때 파라미터 적용
        compose: function (this: ExtendedBlock, containerBlock: Blockly.Block): void {
            let itemBlock = containerBlock.getInputTargetBlock('STACK');
            const newParameters: string[] = [];
            
            // 연결된 파라미터 아이템들을 순회하며 파라미터명 수집
            while (itemBlock) {
                if (itemBlock.type === 'call_parameter_item') {
                    const paramName = itemBlock.getFieldValue('PARAM_NAME') || `param${newParameters.length + 1}`;
                    newParameters.push(paramName);
                }
                itemBlock = itemBlock.nextConnection?.targetBlock() || null;
            }
            
            this.parameters_ = newParameters;
            this.updateShape_!();
        },
        
        updateShape_: function (this: ExtendedBlock) {
            // 기존 파라미터 입력 제거
            let i = 0;
            while (this.getInput('ARG' + i)) {
                this.removeInput('ARG' + i);
                i++;
            }
            
            // 새 파라미터 입력 추가
            for (let j = 0; j < (this.parameters_?.length || 0); j++) {
                this.appendValueInput('ARG' + j)
                    .setCheck(null)
                    .appendField(this.parameters_![j] || `param${j + 1}`);
            }
        },
        onchange: function (this: ExtendedBlock) {
            // 자동 동기화 비활성화 (사용자가 수동으로 파라미터 관리)
            return;
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
            // 숨겨진 필드에서 원본 Python 코드 가져오기
            const logicText = block.getFieldValue('LOGIC_TEXT') || '';


            
            // 들여쓰기 처리 개선 - LOGIC_TEXT의 원본 Python 코드 우선 사용
            let indentedBody = '';
            
            // LOGIC_TEXT에 원본 Python 코드가 있으면 반드시 사용, 없을 때만 bodyCode 사용
            const codeToProcess = logicText && logicText.trim() ? logicText : bodyCode;
            

            
            if (codeToProcess && codeToProcess.trim()) {
                // LOGIC_TEXT에서 온 원본 Python 코드의 경우 함수 본문 레벨로 들여쓰기 추가
                if (codeToProcess === logicText) {
                    // 원본 Python 코드를 함수 본문 레벨로 들여쓰기 적용
                    const lines = codeToProcess.split('\n');
                    const indentedLines: string[] = [];
                    
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        if (line.trim() === '') {
                            indentedLines.push(line); // 빈 줄은 그대로
                            continue;
                        }
                        
                        // 모든 라인에 함수 본문 레벨 들여쓰기 추가
                        indentedLines.push(getIndentString(INDENT_CONFIG.FUNCTION_BODY_LEVEL) + line);
                    }
                    
                    indentedBody = indentedLines.join('\n');
                    // 마지막에 개행이 없으면 추가
                    if (!indentedBody.endsWith('\n')) {
                        indentedBody += '\n';
                    }
                } else {
                    // bodyCode에서 온 경우에만 들여쓰기 처리 적용
                    const lines = codeToProcess.split('\n');
                    const indentedLines: string[] = [];
                    
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        if (line.trim() === '') {
                            indentedLines.push(line); // 빈 줄은 그대로
                            continue;
                        }
                        
                        // 원본 Python 코드의 들여쓰기를 그대로 유지
                        // 함수 본문 내부이므로 기본 들여쓰기만 추가
                        if (line.startsWith('    ')) {
                            // 이미 들여쓰기가 있으면 그대로 사용
                            indentedLines.push(line);
                        } else if (line.startsWith('\t')) {
                            // 탭 들여쓰기를 공백으로 변환
                            const tabCount = (line.match(/^\t+/) || [''])[0].length;
                            const spaceIndent = '    '.repeat(tabCount);
                            indentedLines.push(spaceIndent + line.substring(tabCount));
                        } else {
                            // 들여쓰기가 없는 경우 함수 본문 레벨로 들여쓰기 추가
                            indentedLines.push(getIndentString(INDENT_CONFIG.FUNCTION_BODY_LEVEL) + line);
                        }
                    }
                    
                    indentedBody = indentedLines.join('\n');
                }
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
            // VALUE 입력이 연결되어 있으면 해당 값을 사용, 없으면 기본값 사용
            const returnValue = generator.valueToCode(block, 'VALUE', generator.ORDER_NONE) || 'None';
            
            // 원본 Python 코드는 이미 XML에서 LOGIC_TEXT에 저장되어 있음
            
            // 들여쓰기 처리
            let indentedBody = '';
            
            // bodyText가 있으면 원본 Python 코드를 그대로 사용
            if (bodyText && bodyText.trim()) {
                // 원본 Python 코드는 이미 올바른 들여쓰기를 가지고 있으므로 그대로 사용
                indentedBody = bodyText.trim();
                // 마지막에 개행이 없으면 추가
                if (!indentedBody.endsWith('\n')) {
                    indentedBody += '\n';
                }
            }
            
            // VALUE 블록이 연결되어 있을 때만 추가 return 문 생성
            let finalCode = indentedBody;
            if (generator.valueToCode(block, 'VALUE', generator.ORDER_NONE)) {
                // 원본 코드에 return 문이 이미 있는지 확인
                const hasReturnStatement = indentedBody.includes('return ');
                
                if (!hasReturnStatement) {
                    // return 문이 없을 때만 추가
                    const returnLine = getIndentString(INDENT_CONFIG.FUNCTION_BODY_LEVEL) + `return ${returnValue}\n`;
                    finalCode = indentedBody + returnLine;
                } else {
                    // return 문이 이미 있으면 그대로 사용
                    finalCode = indentedBody;
                }
            }
            
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
        const funcName = block.getFieldValue('NAME') || 'unnamed_function';
        const args: string[] = [];

        // 동적 파라미터 개수 계산 (ARG로 시작하는 입력의 개수)
        const argCount = block.inputList.filter((input: any) => input.name?.startsWith('ARG')).length;

        for (let i = 0; i < argCount; i++) {
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
            this.updateShape_!();
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
            this.updateShape_!();
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

}

export { pythonGenerator }; 