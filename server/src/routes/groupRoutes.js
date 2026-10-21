const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.post('/', groupController.createGroup);
router.get('/', groupController.getUserGroups);
router.get('/:groupId', groupController.getGroupDetails);
router.post('/:groupId/invite', groupController.inviteMember);
router.delete('/:groupId', groupController.deleteGroup);

module.exports = router;
