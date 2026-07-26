const User = require("../models/userSchema");


//for user
//  const userAuth = (req,res,next)=>{
//     if(req.session.user){
//         User.findById(req.session.user)
//         .then(data=>{
//             if(data && !data.isBlocked){
//                 next();
//             }else{
//                 res.redirect("/login")
//             }
//         })
//         .catch(error=>{
//             console.log("Error in user auth middleware");
//             res.status(500).send("Internal server error")
//         })
//     }else{
//         res.redirect("/login")
//     }
//  }




const userAuth = (req, res, next) => {



    

    
    if (req.session.user) {
        User.findById(req.session.user)
            .then(user => {
                if (user && !user.isBlocked) {
                    req.user = user;
                    next();
                } else {
                    // User is blocked — destroy session and redirect
                    req.session.destroy(err => {
                        if (err) {
                            console.log("Error destroying session:", err);
                            return res.status(500).send("Something went wrong");
                        }
                        res.redirect("/login"); 
                    });
                }
            })
            .catch(error => {
                console.log("Error in user auth middleware", error);
                res.status(500).send("Internal server error");
            });
    } else {
        res.redirect("/login");
    }
};


 //admin auth

//  const adminAuth = (req,res,next)=>{
    
//         User.findOne({isAdmin:true})
//         .then(data=>{
//             if(data){
//                 next();
//             }else{
//                 res.redirect("admin/login")
//             }
//         })
//         .catch(error=>{
//             console.log("Error in admin auth middleware",error);
//             res.status(500).send("Internal server error")
//         })
//     }
const adminAuth = (req, res, next) => {
    if (req.session && req.session.admin) {
      next();
    } else {
      res.redirect('/admin/login');
    }
  };
  

    module.exports={
        userAuth,
        adminAuth,
    }
