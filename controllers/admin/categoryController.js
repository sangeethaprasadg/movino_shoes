const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");


// List with Search + Pagination
const getCategories = async (req, res) => {
  const search = req.query.search || "";
  const page = parseInt(req.query.page) || 1;
  const limit = 5;

  const query = {
    isDeleted: false,
    $or: [
      { categoryName: { $regex: search, $options: "i" } },
      { subCategory: { $regex: search, $options: "i" } },
    ],
  };

  const total = await Category.countDocuments(query);
  const categories = await Category.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  res.render("category", {
    categories,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    search,
    limit,
  });
};


// GET: Render Add Category Page
const addCategoryPage = (req, res) => {
  res.render("addCategory", {
    successMessage: req.flash("successMessage"),
    errorMessage: req.flash("errorMessage")
  });
};



const addCategory = async (req, res) => {
  try {
    let { categoryName, subCategory } = req.body;
    const image = req.file ? req.file.filename : null;

    // Normalize input
    const normalizedCategory = categoryName.trim().toLowerCase();
    const normalizedSubCategory = subCategory.trim().toLowerCase();

    // Check if a similar category already exists (case-insensitive match)
    const existingCategory = await Category.findOne({
      categoryName: { $regex: new RegExp(`^${normalizedCategory}$`, 'i') },
      subCategory: { $regex: new RegExp(`^${normalizedSubCategory}$`, 'i') }
    });

    if (existingCategory) {
      req.flash('errorMessage', 'Category already exists!');
      return res.redirect("/admin/categories/add");
    }

    // Save original case (or use .toUpperCase() if you want all caps)
    await Category.create({
      categoryName: categoryName.trim(),
      subCategory: subCategory.trim(),
      image
    });

    req.flash('successMessage', 'Category added successfully!');
    res.redirect("/admin/categories");

  } catch (error) {
    console.error("Error adding category:", error);
    req.flash('errorMessage', 'Something went wrong!');
    res.redirect("/admin/categories/add");
  }
};


const editCategoryPage = async (req, res) => {
  const category = await Category.findById(req.params.id);
  res.render("editCategory", { category });
};

const editCategory = async (req, res) => {
  const { categoryName, subCategory } = req.body;
  const image = req.file ? req.file.filename : undefined;

  const updateData = { categoryName, subCategory };
  if (image) updateData.image = image;

  await Category.findByIdAndUpdate(req.params.id, updateData);
  res.redirect("/admin/categories");
};












const toggleCategoryListing = async (req, res) => {

  try {
    // 1. Find the category
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // 2. Toggle the listing status
    category.isListed = !category.isListed;
    await category.save();

    // 3. Update all related products
    // await Product.updateMany(
    //   { category: category._id },
    //   {
    //     $set: {
    //       isListed: category.isListed,
    //     },
    //   }
    // );


    const products = await Product.find({
    category: category._id
});



const result = await Product.updateMany(
    { category: category._id },
    {
        $set: {
            isListed: category.isListed,
        },
    }
);

console.log(result);

    // 4. Send success response
    res.json({
      success: true,
      isListed: category.isListed,
    });

  } catch (error) {
    console.error("Error toggling category listing:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};



  






module.exports = {
  getCategories,
  addCategoryPage,
  addCategory,
  editCategoryPage,
  editCategory,
  toggleCategoryListing,
};