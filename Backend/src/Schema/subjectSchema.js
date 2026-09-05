const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Subject = sequelize.define('Subject', {
    subject_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    subject_code: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    subject_name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    course_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'courses', key: 'course_id' }
    },
    semester_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'semesters', key: 'semester_id' }
    },
    group_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'subject_groups', key: 'group_id' }
    },

    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'subjects',
    timestamps: false
});

module.exports = Subject;