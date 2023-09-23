//                       ws://127.0.0.1:4001/
const { SerialPort, ReadlineParser } = require('serialport');
const path = "COM4";
const baudRate = 9600;
const arduinoPort = new SerialPort({ path, baudRate });
const parser = new ReadlineParser();
arduinoPort.pipe(parser);

const { v4: uuidv4} = require('uuid');
const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');

// Iniciando servidor http (que será utilizado pra fazer o "handshake") e iniciando o websocket.
const server = http.createServer();
const wsServer = new WebSocketServer({ server });
const port = 4001;

// Todas as conexões ativas vão ser guardadas aqui
const clients = {};

// Request de conexão recebida
wsServer.on('connection', function(connection) {
    // Gera um id único para cada usuário
    const userId = uuidv4();
    // Armazena as conexões novas
    clients[userId] = connection;
    console.log(`${userId} se conectou.`);

    // Ao se desconectar, deleta a conexão da lista de conectados
    connection.on('close', () => {
        console.log(`O ${userId} se desconectou.`);
        delete clients[userId];
    });

});



// Função que vai mandar os dados pra cada um dos usuários conectados
const broadcastMessage = (data) => {
    for(let userId in clients) {
        let client = clients[userId];
        if(client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    }
}

let arrData = [];
let temp = "";
let hum = "";

// Ao receber algum dado do Arduino, chama a função que envia para os clients conectados
parser.on('data', (data)=>{
    // Pega a informação de temperatura da string configurada no arduino
    temp = data.substring(6, 11);
    // Pega a informação de humidade da string configurada no arduino
    hum = data.substring(25, data.length-1);

    let dataHoje = new Date();
    let horas = dataHoje.getHours() + ":" + dataHoje.getMinutes() + ":" + dataHoje.getSeconds()

    // Caso o conjunto de dados ultrapasse o número determinado, exclui o item mais antigo.
    if(arrData.length > 100){
        arrData.reverse().pop();
        arrData.reverse();
    }

    // Adiciona os dados de temperatura, humidade e horas no array.
    arrData.push({
        "temp":parseFloat(temp).toFixed(1),
        "hum":parseFloat(hum).toFixed(1), 
        "hora":horas
    });

    // Começa a transmitir informações apenas quando tiver dados no array
    if(arrData.length > 1){
        console.log(arrData);
        broadcastMessage(JSON.stringify(arrData));
    }
});

// Configura a porta que será ouvida pelo servidor.
server.listen(port, () => {
    console.log(`O servidor WebSocket está sendo executado na porta ${port}`);
});