const { getAllGroups, createGroup, deleteGroup } = require('../service/subjectGroupService');
async function getGroupsController(req, res) {
    try {
        const result = await getAllGroups();
        return res.json({ success: true, data: result });
    } catch (error) {
        console.error('Subject Groups Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
}
async function createGroupController(req, res) {
    try {
        const { subject_ids } = req.body;
        const result = await createGroup(subject_ids);
        return res.json({ success: true, message: 'Group created', data: result });
    } catch (error) {
        console.error('Create Group Error:', error);
        return res.status(400).json({ success: false, message: error.message });
    }
}
async function deleteGroupController(req, res) {
    try {
        const result = await deleteGroup(req.params.group_id);
        return res.json({ success: true, ...result });
    } catch (error) {
        console.error('Delete Group Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
}
module.exports = { getGroupsController, createGroupController, deleteGroupController };
