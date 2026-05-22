const express = require('express');
const router = express.Router();
const { protectAny, protectAdmin } = require('../middleware/auth');
const { getCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/categoryController');

router.get('/', protectAny, getCategories);
router.post('/', protectAdmin, createCategory);
router.patch('/:id', protectAdmin, updateCategory);
router.delete('/:id', protectAdmin, deleteCategory);

module.exports = router;
