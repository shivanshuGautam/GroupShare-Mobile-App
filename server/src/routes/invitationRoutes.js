const express = require('express');
const router = express.Router();
const invitationController = require('../controllers/invitationController');
const authMiddleware = require('../middleware/auth');

// Protected routes (requires authenticated user)
router.get('/user/pending', authMiddleware, invitationController.getUserPendingInvitations);
router.get('/pending', authMiddleware, invitationController.getUserPendingInvitations);
router.post('/:invitationId/accept', authMiddleware, invitationController.acceptInvitation);
router.post('/:invitationId/decline', authMiddleware, invitationController.declineInvitation);

// Public route to view / preview invitation by token (deep linking support)
router.get('/:token', invitationController.getInvitationByToken);

module.exports = router;
