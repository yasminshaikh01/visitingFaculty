const {DataTypes} = require('sequelize');
const sequelize = require('../config/database');

const SubjectGroup = sequelize.define('SubjectGroup', {
    group_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    group_name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    combined_code: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'subject_groups',
    timestamps: false
});
module.exports = SubjectGroup;