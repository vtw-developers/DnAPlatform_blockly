import * as Blockly from 'blockly';

declare global {
  interface Window {
    Blockly: typeof Blockly;
  }
} 