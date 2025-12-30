const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('basic.js', 'utf8');
const script = new vm.Script(code);
const context = vm.createContext({ console, process });
script.runInContext(context);

const BasicInterpreter = context.BasicInterpreter;

let basicCode = `
FUNCTION fib%(n%)
    IF n% < 2 THEN 
        rVal% =  n%
    ELSE    
        rVal% =   fib%(n% - 1) + fib%(n% - 2)
    END IF   
    RETURN rVal%
END FUNCTION

PRINT fib%(10);
`;

const fileName = process.argv[2];
if (fileName) {
    try {
        basicCode = fs.readFileSync(fileName, 'utf8');
    } catch (err) {
        console.error(`Error reading file ${fileName}: ${err.message}`);
        process.exit(1);
    }
}

const interpreter = new BasicInterpreter({ debug: false });
try {
    interpreter.runProgram(basicCode);
} catch (e) {
    console.error(e.message);
}
