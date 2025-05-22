const express = require('express');
const {
  getMe,
  updateDetails,
  updatePassword,
  uploadPhoto,
  deleteAccount,
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser
} = require('../controllers/users');

const { protect, authorize } = require('../middleware/auth');
const advancedResults = require('../middleware/advancedResults');
const User = require('../models/User');
const { handleFileUpload } = require('../utils/fileUpload');

const router = express.Router();

// All routes are protected
router.use(protect);

// Routes for /api/v1/auth
router
  .route('/me')
  .get(getMe)
  .delete(deleteAccount);

router.put('/updatedetails', updateDetails);
router.put('/updatepassword', updatePassword);
router.put(
  '/photo',
  handleFileUpload('image', 'avatar'),
  uploadPhoto
);

// Admin routes
router.use(authorize('admin'));

router
  .route('/')
  .get(
    advancedResults(User, [
      { path: 'projects', select: 'name' },
      { path: 'assignedTasks', select: 'title status' }
    ]),
    getUsers
  )
  .post(createUser);

router
  .route('/:id')
  .get(getUser)
  .put(updateUser)
  .delete(deleteUser);

module.exports = router;
