import prompt from 'prompt-sync';

export function pickColor(videoNumber, useCustomBackground) {
  return new Promise((resolve, reject) => {
    if (!useCustomBackground) {
      return resolve("000000");
    } else {
      throw new Error("Custom color Not implemented yet");
      // return resolve(prompt("Please enter your custom background color in HEX (e.g., #FF5733): "));
    }
  });
}