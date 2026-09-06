let idCounter = 0;

export const getId = (): string => {
  return `node_${idCounter++}`;
}; 