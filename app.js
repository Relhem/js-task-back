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
      response.status(200).json(dbResponse);
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







