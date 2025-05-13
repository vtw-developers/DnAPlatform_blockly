import * as Blockly from 'blockly';
import { pythonGenerator } from 'blockly/python';

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

    // 함수 정의 블록 (뮤테이터 및 파라미터 이름/개수 동기화)
    Blockly.Blocks['ast_Summarized_FunctionDef'] = {
        init: function (this: Blockly.Block & { parameters_?: string[] }) {
            this.appendDummyInput()
                .appendField('Function')
                .appendField(new Blockly.FieldTextInput('func_name'), 'NAME');
            this.setColour(210);
            this.setTooltip('Custom function block with parameter mutation.');
            this.setHelpUrl('');
            this.parameters_ = [];
            this.appendStatementInput('BODY')
                .setCheck(null)
                .appendField('Body');
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
        decompose: function (this: Blockly.Block & { parameters_?: string[] }, workspace: Blockly.Workspace) {
            const containerBlock = workspace.newBlock('parameters_container');
            (containerBlock as any).initSvg && (containerBlock as any).initSvg();
            let connection = containerBlock.getInput('STACK')?.connection;
            for (const param of this.parameters_ || []) {
                const paramBlock = workspace.newBlock('ast_FunctionParameter');
                (paramBlock as any).initSvg && (paramBlock as any).initSvg();
                paramBlock.setFieldValue(param, 'NAME');
                if (connection && paramBlock.previousConnection) {
                    connection.connect(paramBlock.previousConnection);
                    connection = paramBlock.nextConnection;
                }
            }
            return containerBlock;
        },
        compose: function (this: Blockly.Block & { parameters_?: string[] }, containerBlock: Blockly.Block) {
            let itemBlock = containerBlock.getInputTargetBlock('STACK');
            const params: string[] = [];
            while (itemBlock) {
                params.push(itemBlock.getFieldValue('NAME'));
                itemBlock = itemBlock.nextConnection && itemBlock.nextConnection.targetBlock();
            }
            this.parameters_ = params;
            (this as any).updateShape_();
        },
        updateShape_: function (this: Blockly.Block & { parameters_?: string[] }) {
            let i = 0;
            while (this.getInput('PARAMETER' + i)) {
                this.removeInput('PARAMETER' + i);
                i++;
            }
            for (let j = 0; j < (this.parameters_?.length || 0); j++) {
                this.appendValueInput('PARAMETER' + j)
                    .setCheck(null)
                    .appendField(this.parameters_![j]);
            }
            if (this.getInput('BODY')) {
                this.moveInputBefore('BODY', null);
            }
        },
        mutator: 'parameters_mutator'
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

    // Python Generator 등록
    pythonGenerator['ast_Summarized_FunctionDef'] = function (block: Blockly.Block & { parameters_?: string[] }): string {
        const funcName = block.getFieldValue('NAME') || 'unnamed_function';
        const paramList: string[] = [];
        for (let i = 0; i < (block.parameters_?.length || 0); i++) {
            const paramBlock = block.getInputTargetBlock('PARAMETER' + i);
            if (paramBlock) {
                const paramCode = pythonGenerator.blockToCode(paramBlock);
                if (Array.isArray(paramCode)) {
                    paramList.push(paramCode[0]);
                } else {
                    paramList.push(paramCode);
                }
            }
        }
        const params = paramList.join(', ');
        const bodyCode = pythonGenerator.statementToCode(block, 'BODY');
        const code = `def ${funcName}(${params}):\n` + pythonGenerator.prefixLines(bodyCode || 'pass\n', '  ');
        return code;
    };
    pythonGenerator['ast_FunctionParameter'] = function (block: Blockly.Block): [string, number] {
        const paramName = block.getFieldValue('NAME') || 'param';
        return [paramName, pythonGenerator.ORDER_ATOMIC];
    };
    pythonGenerator['ast_ReturnFull'] = function (block: Blockly.Block): string {
        const bodyText = block.getFieldValue('TEXT') || '';
        const returnValue = pythonGenerator.valueToCode(block, 'VALUE', pythonGenerator.ORDER_NONE) || 'None';
        const indentedBody = pythonGenerator.prefixLines(bodyText.trim(), pythonGenerator.INDENT);
        const returnLine = pythonGenerator.INDENT + `return ${returnValue}\n`;
        return indentedBody + '\n' + returnLine;
    };
    pythonGenerator['ast_Name'] = function (block: Blockly.Block): [string, number] {
        const varName = block.getFieldValue('VAR') || 'var';
        return [varName, pythonGenerator.ORDER_ATOMIC];
    };
    pythonGenerator['procedures_callreturn'] = function (block: Blockly.Block & { parameters_?: string[] }): [string, number] {
        const funcName = block.getFieldValue('NAME') || 'unnamed';
        const args: string[] = [];
        for (let i = 0; i < (block.parameters_?.length || 0); i++) {
            const argCode = pythonGenerator.valueToCode(block, 'ARG' + i, pythonGenerator.ORDER_NONE) || 'None';
            args.push(argCode);
        }
        const code = `${funcName}(${args.join(', ')})`;
        return [code, pythonGenerator.ORDER_FUNCTION_CALL];
    };
    pythonGenerator['procedures_callnoreturn'] = function (block: Blockly.Block & { parameters_?: string[] }): string {
        const funcName = block.getFieldValue('NAME') || 'unnamed';
        const args: string[] = [];
        for (let i = 0; i < (block.parameters_?.length || 0); i++) {
            const argCode = pythonGenerator.valueToCode(block, 'ARG' + i, pythonGenerator.ORDER_NONE) || 'None';
            args.push(argCode);
        }
        return `${funcName}(${args.join(', ')})\n`;
    };

    // Mutator 믹스인 객체 분리
    const PARAMETERS_MUTATOR_MIXIN = {
        mutationToDom: Blockly.Blocks['ast_Summarized_FunctionDef'].mutationToDom,
        domToMutation: Blockly.Blocks['ast_Summarized_FunctionDef'].domToMutation,
        decompose: Blockly.Blocks['ast_Summarized_FunctionDef'].decompose,
        compose: Blockly.Blocks['ast_Summarized_FunctionDef'].compose,
        updateShape_: Blockly.Blocks['ast_Summarized_FunctionDef'].updateShape_,
    };

    Blockly.Extensions.registerMutator(
        'parameters_mutator',
        PARAMETERS_MUTATOR_MIXIN,
        undefined,
        ['ast_FunctionParameter']
    );
} 