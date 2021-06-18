require('dotenv').config();

const express = require("express");

const app = express();

const cors = require('cors');
app.use(cors());
app.options('*', cors());

const { DATABASE, LOGIN, PASSWORD, DIALECT, HOST } = process.env;

const Sequelize = require("sequelize");
const sequelize = new Sequelize(DATABASE, LOGIN, PASSWORD, {
    dialect: DIALECT,
    host: HOST,
});
const models = require('./models/node')
const jsonParser = express.json();

sequelize.authenticate().then(() => {
  console.log('Sucessfully connected to DB.');

  const AppNodeModel = sequelize.define('AppNode', models.AppNode);
  AppNodeModel.sync().then(() => {
    console.log('AppNode synchronized.');
  });

  // READ
  app.get("/api/nodes", async function(request, response){
    const { offset, limit, whereNameIsLike } = request.query;
    try {
      let dbResponse;
      if (whereNameIsLike) {
        dbResponse = await AppNodeModel.findAll({
          raw: true,
          where: {
            name: {
              [Sequelize.Op.iLike]: '%' + whereNameIsLike + '%'
            },
          }});
      } else
      if (offset && limit) {
        dbResponse = await AppNodeModel.findAll({ raw: true, offset, limit });
      } else {
        dbResponse = await AppNodeModel.findAll({ raw: true });
      }
      const allCount = await AppNodeModel.count();
      response.status(200).json({ dbResponse, allCount });
    } catch (dbError) {
      const errorType = JSON.parse(JSON.stringify(dbError)).name;
      response.status(500).json({ error: 'error', message: errorType });
    }
  });

  app.get("/api/nodes/null", function(request, response){
    AppNodeModel.findAll({
      raw: true,
      where: {
        parentId: null,
      }}).then((dbResponse) => {
        response.status(200).json(dbResponse);
      }, (dbError) => {
        const errorType = JSON.parse(JSON.stringify(dbError)).name;
        response.status(500).json({ error: 'error', message: errorType });
      });
  });

  // CREATE
  app.post("/api/nodes/", jsonParser, function(request, response) {
    const { name, parentId, IP, port } = request.body;
    AppNodeModel.create({ name,
      parentId,
      IP,
      port
    }).then((dbResponse) => {
      response.status(200).json({ result: 'success', message: dbResponse.dataValues });
    }, (dbError) => {
      let errorType = JSON.parse(JSON.stringify(dbError)).name;
      if (errorType === 'SequelizeUniqueConstraintError') {
        errorType = 'узел с таким именем уже существует';
      };
      response.status(500).json({ result: 'error', message: errorType });
    });
  });

  app.get("/api/nodes/:id/children", function(request, response){
    const { id } = request.params;
    AppNodeModel.findAll({ raw: true, where: {
      parentId: id,
    }}).then((dbResponse) => {
      response.status(200).json(dbResponse);
    }, (dbError) => {
      const errorType = JSON.parse(JSON.stringify(dbError)).name;
      response.status(500).json({ error: 'error', message: errorType });
    });
  });

  // UPDATE
  app.put("/api/nodes/:id", jsonParser, function(request, response) {
    const { id } = request.params;
    const { name, parentId, IP, port } = request.body;
    console.log({ id, name, parentId, IP, port })
    AppNodeModel.update({ name,
      parentId,
      IP,
      port
    }, {
      where: {
        id
      }
    }).then(() => {
      response.status(200).json({ result: 'success' });
    }, (dbError) => {
      let errorType = JSON.parse(JSON.stringify(dbError)).name;
      if (errorType === 'SequelizeUniqueConstraintError') {
        errorType = 'узел с таким именем уже существует';
      };
      response.status(500).json({ result: 'error', message: errorType });
    });
  });

  // DELETE
  app.delete("/api/nodes/:id", jsonParser, function(request, response) {
    const { id } = request.params;
    AppNodeModel.destroy({
      where: {
        id
      }
    }).then((dbResponse) => {
      response.status(200).json({ result: 'success', message: `${dbResponse}` });
    }, (dbError) => {
      const errorType = JSON.parse(JSON.stringify(dbError)).name;
      response.status(500).json({ result: 'error', message: errorType });
    });
  });

  app.listen(4000);
}, () => {
  console.log('Connection failed.');
});



const WebSocket = require('ws');
const wsServer = new WebSocket.Server({ port: 9000 });

const wsClients = new Map();

const serverData = {
  currentValue: 0,
  usernames: {},
  messageId: 0,
};

function send( wsClient, { action, value }) {
  wsClient.send(JSON.stringify({ action, value }));
}

function onConnect(wsClient) {
  wsClient.send(JSON.stringify({ action: 'SET_VALUE', value: serverData.currentValue }));

  let username = null;
  const uniqueId = require("crypto").randomBytes(64).toString('hex');
  wsClient.send(JSON.stringify({ action: 'SET_CONNECTION_ID', value: uniqueId }));
  
  wsClients.set(uniqueId, wsClient);
  
  wsClient.on('message', function(msg) {
    const message = JSON.parse(msg);
      console.log('--->', message);

      if (message.action === 'SEND_MESSAGE') {
        const broadcast = () => {
          wsServer.clients.forEach((_wsClient) => {
            const value = {
              message: message.value.message,
              sentBy: serverData.usernames[message.value.connectionId],
              messageId: serverData.messageId,
            };
            serverData.messageId += 1;
            console.log(value);
            send(_wsClient, { action: 'MESSAGE_FROM_SERVER', value });
          });
        };
        broadcast();
      }

      if (message.action === 'USER_ENTER') {
        const { value } = message;
        let usernameIsAvailable = true;
        Object.keys(serverData.usernames).forEach((uniqueId) => {
          const _username = serverData.usernames[uniqueId];
          if (_username == value.username) usernameIsAvailable = false;
        });
        if (usernameIsAvailable) {
          serverData.usernames[uniqueId] = value.username;
          const users = Object.keys(serverData.usernames).map((uniqueId) => serverData.usernames[uniqueId]);

          send(wsClient, { action: 'USER_ENTER_SUCCESS', value: { username: value.username, users } });
        } else send(wsClient, { action: 'USER_ENTER_FAIL' });
      }

      if (message.action === 'SEND_VALUE') {
        const { value } = message;
        serverData.currentValue = value;
        wsServer.clients.forEach((_wsClient) => {
          try {
            _wsClient.send(JSON.stringify({ action: 'SET_VALUE', value: serverData.currentValue }));
          } catch (error) {
            console.error(error);
          }
        });
      }
  });
  wsClient.on('close', function(wsClient) {
      console.log(wsClient);
      wsClients.delete(uniqueId);
      delete serverData.usernames[uniqueId];
      console.log(`Пользователь ${uniqueId} отключился`);
  });
};

wsServer.on('connection', onConnect);



