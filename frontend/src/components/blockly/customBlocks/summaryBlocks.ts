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

    // 함수 정의 블록
    Blockly.Blocks['ast_Summarized_FunctionDef'] = {
        init: function (this: Blockly.Block & { parameterCount_: number }) {
            this.appendDummyInput()
                .appendField('Function')
                .appendField(new Blockly.FieldTextInput('func_name'), 'NAME');
            this.setColour(210);
            this.setTooltip('Custom function block with parameter mutation.');
            this.setHelpUrl('');
            this.parameterCount_ = 0;
            this.appendStatementInput('BODY')
                .setCheck(null)
                .appendField('Body');
        },
        mutationToDom: function (this: Blockly.Block & { parameterCount_: number }): Element {
            const container = document.createElement('mutation');
            container.setAttribute('parameters', String(this.parameterCount_));
            return container;
        },
        domToMutation: function (this: Blockly.Block & { parameterCount_: number }, xmlElement: Element): void {
            const paramCount = parseInt(xmlElement.getAttribute('parameters') || '0', 10) || 0;
            this.parameterCount_ = paramCount;
            (this as any).updateShape_ && (this as any).updateShape_();
        },
        updateShape_: function (this: Blockly.Block & { parameterCount_: number }): void {
            let i = 0;
            while (this.getInput('PARAMETER' + i)) {
                this.removeInput('PARAMETER' + i);
                i++;
            }
            for (let j = 0; j < this.parameterCount_; j++) {
                this.appendValueInput('PARAMETER' + j)
                    .setCheck(null)
                    .appendField('Param ' + (j + 1));
            }
            if (this.getInput('BODY')) {
                this.moveInputBefore('BODY', null);
            }
        }
    };

    Blockly.Blocks['ast_function_param_container'] = {
        init: function (this: Blockly.Block) {
            this.appendDummyInput().appendField('parameters');
            this.appendStatementInput('STACK');
            this.setColour(210);
            this.setTooltip('Add parameters');
            this.contextMenu = false;
        }
    };

    Blockly.Blocks['parameters_container'] = {
        init: function (this: Blockly.Block) {
            this.appendDummyInput().appendField('parameters');
            this.appendStatementInput('STACK');
            this.setColour(260);
            this.setTooltip('');
            this.contextMenu = false;
        }
    };

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

    Blockly.Blocks['ast_Name'] = {
        init: function (this: Blockly.Block) {
            this.appendDummyInput().appendField(new Blockly.FieldTextInput('variable'), 'VAR');
            this.setOutput(true, null);
            this.setColour(210);
            this.setTooltip('Variable reference');
            this.setHelpUrl('');
        }
    };

    // Mutator Mixin
    const PARAMS_MUTATOR_MIXIN = {
        parameterCount_: 0,
        mutationToDom: function (this: Blockly.Block & { parameterCount_: number }): Element {
            const container = document.createElement('mutation');
            container.setAttribute('parameters', String(this.parameterCount_));
            return container;
        },
        domToMutation: function (this: Blockly.Block & { parameterCount_: number }, xmlElement: Element): void {
            this.parameterCount_ = parseInt(xmlElement.getAttribute('parameters') || '0', 10);
            (this as any).updateShape_ && (this as any).updateShape_();
        },
        decompose: function (this: Blockly.Block & { parameterCount_: number }, workspace: Blockly.Workspace): Blockly.Block {
            const containerBlock = workspace.newBlock('parameters_container');
            if ((containerBlock as any).initSvg) (containerBlock as any).initSvg();
            let connection = containerBlock.getInput('STACK')?.connection;
            for (let i = 0; i < this.parameterCount_; i++) {
                const paramBlock = workspace.newBlock('ast_FunctionParameter');
                if ((paramBlock as any).initSvg) (paramBlock as any).initSvg();
                if (connection && paramBlock.previousConnection) {
                    connection.connect(paramBlock.previousConnection);
                    connection = paramBlock.nextConnection;
                }
            }
            return containerBlock;
        },
        compose: function (this: Blockly.Block & { parameterCount_: number }, containerBlock: Blockly.Block): void {
            let itemBlock = containerBlock.getInputTargetBlock('STACK');
            const parameters = [];
            while (itemBlock) {
                parameters.push(itemBlock);
                itemBlock = itemBlock.nextConnection && itemBlock.nextConnection.targetBlock();
            }
            this.parameterCount_ = parameters.length;
            (this as any).updateShape_ && (this as any).updateShape_();
        },
        updateShape_: function (this: Blockly.Block & { parameterCount_: number }): void {
            let i = 0;
            while (this.getInput('PARAMETER' + i)) {
                this.removeInput('PARAMETER' + i);
                i++;
            }
            for (let j = 0; j < this.parameterCount_; j++) {
                this.appendValueInput('PARAMETER' + j)
                    .setCheck(null)
                    .appendField('param');
            }
        }
    };
    Blockly.Extensions.registerMutator(
        'parameters_mutator',
        PARAMS_MUTATOR_MIXIN,
        undefined,
        ['ast_FunctionParameter']
    );

    // Python Generator
    pythonGenerator['ast_Summarized_FunctionDef'] = function (block: Blockly.Block & { parameterCount_: number }): string {
        const funcName = block.getFieldValue('NAME') || 'unnamed_function';
        const paramCount = block.parameterCount_ || 0;
        const paramList: string[] = [];
        for (let i = 0; i < paramCount; i++) {
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
} 