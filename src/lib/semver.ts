export function compare(v1: string, v2: string) {
    const s1 = parse(v1);
    const s2 = parse(v2);

    for (let i = 0; i < 3; ++i) {
        const diff = (s1[i] as number) - (s2[i] as number);

        if (diff !== 0)
            return diff;
    }

    return s1[3].localeCompare(s2[3]);
}

export function parse(value: string): [number, number, number, string] {
    const parts = value.split('.', 3);
    const patch = /^(\d+)(.*)$/.exec(parts[2] || '0');

    return [ 
        parseInt(parts[0]), 
        parseInt(parts[1]), 
        parseInt(patch![1]),
        patch![2]
    ];
}