import * as Blockly from 'blockly/core';

export function registerJpypeBlocks(pythonGen: any) {
  // 1. JVM 시작 블록
  Blockly.Blocks['jpype_start_jvm'] = {
    init: function() {
      this.appendDummyInput()
        .appendField("JAR 파일 경로")
        .appendField(new Blockly.FieldTextInput("/path/to/your-file.jar"), "JAR_PATH")
        .appendField("으로 JVM 시작");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip("JAR 파일을 로드하고 JVM을 시작합니다.");
      this.setHelpUrl("");
    }
  };

  // 2. JVM 종료 블록
  Blockly.Blocks['jpype_shutdown_jvm'] = {
    init: function() {
      this.appendDummyInput()
        .appendField("JVM 종료");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip("JVM을 종료합니다.");
      this.setHelpUrl("");
    }
  };

  // 3. Java 메서드 호출 블록
  Blockly.Blocks['jpype_java_method_call'] = {
    init: function() {
      this.appendDummyInput()
        .appendField("Java 클래스")
        .appendField(new Blockly.FieldTextInput("org.apache.commons.codec.binary.Base64"), "CLASS_NAME")
        .appendField("의");
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput("encodeBase64"), "METHOD_NAME")
        .appendField("메서드 호출");
      this.appendValueInput("ARGS")
        .setCheck(null)
        .appendField("인자");
      this.appendDummyInput()
        .appendField("결과를")
        .appendField(new Blockly.FieldTextInput("encoded_bytes"), "RESULT_VAR")
        .appendField("에 저장");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip("Java 메서드를 호출하고 결과를 변수에 저장합니다.");
      this.setHelpUrl("");
    }
  };

  if (pythonGen) {
    pythonGen['jpype_start_jvm'] = function(block: Blockly.Block) {
      const jar_path = block.getFieldValue('JAR_PATH');
      const code = `import jpype\nimport jpype.imports\njpype.startJVM(classpath=['${jar_path}'])\n`;
      return code;
    };

    pythonGen['jpype_shutdown_jvm'] = function(_block: Blockly.Block) {
      return 'jpype.shutdownJVM()\n';
    };

    pythonGen['jpype_java_method_call'] = function(block: Blockly.Block) {
      const class_name = block.getFieldValue('CLASS_NAME');
      const method_name = block.getFieldValue('METHOD_NAME');
      const arg = pythonGen.valueToCode(block, 'ARGS', pythonGen.ORDER_ATOMIC) || '';
      const result_var = block.getFieldValue('RESULT_VAR');
      const import_code = `from ${class_name.substring(0, class_name.lastIndexOf('.') )} import ${class_name.split('.').pop()}\n`;
      const code = `${import_code}${result_var} = ${class_name.split('.').pop()}.${method_name}(${arg})\n`;
      return code;
    };
  }
} 