export default function splitArray<T>(array: T[], parts: number): T[][] {
    let result: T[][] = [[]];
    
    for (let i = 0; i < array.length; i++) {
        if (i / parts % 1 === 0 && i !== 0) {
            result.push([array[i]]);
        } else {
            result[result.length - 1].push(array[i]);
        }
    }

    return result;
}