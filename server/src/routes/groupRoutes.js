const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const invitationController = require('../controllers/invitationController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.post('/', groupController.createGroup);
router.get('/', groupController.getUserGroups);
router.get('/:groupId', groupController.getGroupDetails);
router.delete('/:groupId', groupController.deleteGroup);

// Invitation endpoints under group
router.post('/:groupId/invite', invitationController.sendInvitation);
router.get('/:groupId/invitations', invitationController.getGroupInvitations);
router.post('/:groupId/invitations/:invitationId/resend', invitationController.resendInvitation);
router.delete('/:groupId/invitations/:invitationId', invitationController.cancelInvitation);

module.exports = router;
