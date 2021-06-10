const Sequelize = require("sequelize");

const AppNode = {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
    },
    parentId: {
      type: Sequelize.INTEGER,
      references: {
        model: 'AppNodes',
        key: 'id',
      },
      allowNull: true,
      onDelete: 'cascade',
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
    },
    IP: {
        type: Sequelize.STRING,
        allowNull: false
    },
    port: {
      type: Sequelize.INTEGER,
      allowNull: false
    }
};


module.exports = { AppNode }
