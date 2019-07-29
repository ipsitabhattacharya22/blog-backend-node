const express = require('express');
const app = express.Router();
var CrypJs = require('node-cryptojs-aes').CryptoJS;
const mydb = require('../utils/db');
var moment = require('moment');
// const logger = require('../utils/logger')(__filename);



app.post("/addBlogPost", function (request, response) {
    var blogHeader = request.body.blogHeader;
    var blogContent = request.body.blogContent;

    if (blogHeader && blogContent) {
        var doc = {
            "blogHeader": request.body.blogHeader,
            "blogContent": request.body.blogContent,
            "createdAt": new Date().toISOString(),
            "totalComments": 0,
            "comments": []
        };
        if (!mydb) {
            console.log("No database.");
            response.status(500).send("Database connection is not ready");
            return;
        }

        // insert the username as a document
        mydb.insert(doc, function (err, body, header) {
            if (err) {
                console.log('[mydb.insert] ', err.message);
                response.status(500).send("Error in adding blog");
                return;
            }
            doc._id = body.id;
            const res = {
                "status": "SUCCESS",
                "_id": doc._id,
                "message": "Blog created successfully"
            }
            response.send(res);
        });
    } else {
        response.status(400).send({
            "Error": "Missing parameter"
        });
    }
});

app.get("/getBlogs", function (request, response) {
    var blogList = [];
    var sortedList
    if (!mydb) {
        console.log("No database.");
        response.status(500).send("Database connection is not ready");
        return;
    }

    mydb.list({
        include_docs: true
    }, function (err, body) {
        if (!err) {
            body.rows.forEach(function (row) {
                if (row.doc) {
                    blogList.push(row.doc);
                    sortedList = blogList.sort((var1, var2) => {
                        let a = new Date(var1.createdAt);
                        let b = new Date(var2.createdAt);
                        if (a > b)
                            return 1;
                        if (a < b)
                            return -1;
                        return 0;
                    })
                }
            });
            const res = {
                "status": "SUCCESS",
                "blogList": sortedList
            }
            response.json(res);
        } else {
            response.status(404).send({
                "Error": "No blog found"
            });
        }
    });
});

app.post("/getSelectedBlog", function (request, response) {
    var blogId = request.body._id;
    if (!mydb) {
        console.log("No database.");
        response.status(500).send("Database connection is not ready");

    }

    if (blogId) {
        mydb.find({
            "selector": {
                "_id": blogId
            }
        }, function (er, result) {
            if (er) {
                console.log(er);
                response.status(503).send("Too many requests to Database.");
                return;

            }
            if (result.docs && result.docs.length) {
                response.send(result.docs[0]);
            } else {
                response.status(404).send({
                    "Error": "Blog Not Found"
                });
            }
        });
    } else {
        response.status(400).send({
            "Error": "Missing parameter"
        });
    }
});

app.post("/addComments", function (request, response) {
    var blogId = request.body._id;
    var comment = request.body.comments;
    var commentId;
    var comments = {};
    var updatedComments;

    if (!mydb) {
        console.log("No database.");
        response.status(500).send("Database connection is not ready");
        return;

    }
    if (blogId && comment) {
        mydb.find({
            "selector": {
                "_id": blogId
            }
        }, function (er, res) {
            if (er) {
                console.log(er);
                res.status(503).send("Too many requests to Database.");
                return;
            }
            if (res.docs && res.docs.length) {
                const result = generateCommentId(blogId).then(val => {
                    commentId = val;

                    comments = {
                        _id: commentId,
                        text: comment
                    };
                    updatedComments = res.docs[0].comments;
                    updatedComments.push(comments);
                    const updatedBlog = {
                        blogHeader: res.docs[0].blogHeader,
                        blogContent: res.docs[0].blogContent,
                        _id: res.docs[0]._id,
                        _rev: res.docs[0]._rev,
                        createdAt: res.docs[0].createdAt,
                        totalComments: res.docs[0].totalComments + 1,
                        comments: updatedComments
                    };
                    mydb.insert(updatedBlog, function (err, body, header) {
                        if (err) {
                            console.log('[mydb.insert] ', err.message);
                            response.send("Error in adding comment");
                            return;
                        }
                        const res = {
                            "status": "SUCCESS",
                            "message": "Comment added successfully"
                        }
                        response.send(res);
                    });
                });
            } else {
                response.status(404).send({
                    "Error": "Blog Not Found"
                });
            }
        });

    } else {
        response.status(400).send({
            "Error": "Missing parameter"
        });
    }
});

app.post("/editComments", (request, response) => {
    var blogId = request.body.blogId;
    var commentId = request.body.commentId;
    var commentText = request.body.commentText;
    var updatedComments;
    if (blogId && commentId && commentText) {
        if (!mydb) {
            console.log("No database.");
            response.status(500).send("Database connection is not ready");
            return;
        }
        mydb.find({
            "selector": {
                "_id": blogId,
                "comments": {
                    "$elemMatch": {
                        "_id": commentId
                    }
                }
            }
        }, (er, blogRes) => {
            if (er) {
                console.log('Query Error', er.message);
                response.status(503).send("Too many request to database");
                return;
            }
            if (blogRes.docs && (blogRes.docs.length == 1)) {
                blogRes.docs[0].comments.filter(comment => {
                    if (comment._id === commentId) {
                        comment._id = commentId;
                        comment.text = commentText;
                    }
                });
                console.log('Updated now: ', blogRes.docs[0].comments);
                updatedComments = blogRes.docs[0].comments;
                const updatedBlog = {
                    blogHeader: blogRes.docs[0].blogHeader,
                    blogContent: blogRes.docs[0].blogContent,
                    _id: blogRes.docs[0]._id,
                    _rev: blogRes.docs[0]._rev,
                    createdAt: blogRes.docs[0].createdAt,
                    totalComments: blogRes.docs[0].totalComments,
                    comments: updatedComments
                };
                mydb.insert(updatedBlog, function (err, body, header) {
                    if (err) {
                        console.log('[mydb.insert] ', err.message);
                        response.send("Error in editing comment");
                        return;
                    }
                    const res = {
                        "status": "SUCCESS",
                        "message": "Comment edited successfully"
                    }
                    response.send(res);
                });
            } else {
                console.log({
                    "Error": "Blog not found"
                })
                response.status(404).send({
                    "Error": "Blog not found"
                });
            }
        });
    } else {
        console.log({
            "Error": "Missing parameter"
        })
        response.status(400).send({
            "Error": "Missing parameter"
        });
    }
});

app.post("/deleteComments", (request, response) => {
    var blogId = request.body.blogId;
    var commentId = request.body.commentId;
    var updatedComments;
    if (blogId && commentId) {

        if (!mydb) {
            console.log("No database.");
            response.status(500).send("Database connection is not ready");
            return;

        }
        mydb.find({
            "selector": {
                "_id": blogId,
                "comments": {
                    "$elemMatch": {
                        "_id": commentId
                    }
                }
            }
        }, (er, blogRes) => {
            if (er) {
                console.log('Query Error', er.message);
                response.send("Error");
                return;
            }
            if (blogRes.docs && (blogRes.docs.length == 1)) {
                blogRes.docs[0].comments.filter((comment, index) => {
                    if (comment._id === commentId) {
                        blogRes.docs[0].comments.splice(index, 1);
                    }
                });
                console.log('Updated now: ', blogRes.docs[0].comments);
                updatedComments = blogRes.docs[0].comments;
                const updatedBlog = {
                    blogHeader: blogRes.docs[0].blogHeader,
                    blogContent: blogRes.docs[0].blogContent,
                    _id: blogRes.docs[0]._id,
                    _rev: blogRes.docs[0]._rev,
                    createdAt: blogRes.docs[0].createdAt,
                    totalComments: blogRes.docs[0].comments.length,
                    comments: updatedComments
                };
                mydb.insert(updatedBlog, function (err, body, header) {
                    if (err) {
                        console.log('[mydb.insert] ', err.message);
                        response.send("Error in deleting comment");
                        return;
                    }
                    const res = {
                        "status": "SUCCESS",
                        "message": "Comment deleted successfully"
                    }
                    response.send(res);
                });
            } else {
                response.status(404).send({
                    "Error": "Blog not found"
                });
            }
        });
    } else {
        response.status(400).send({
            "Error": "Missing parameter"
        });
    }
});

app.post("/updateBlog", (request, response) => {
    var blogId = request.body.blogId;
    var blogHeader = request.body.blogHeader;
    var blogContent = request.body.blogContent;
    var updatedComments;
    if (blogId && blogHeader && blogContent) {
        if (!mydb) {
            console.log("No database.");
            response.status(500).send("Database connection is not ready");
            return;
        }
        mydb.find({
            "selector": {
                "_id": blogId
            }
        }, (er, res) => {
            if (er) {
                console.log('Query Error', er.message);
                response.status(503).send("Too many request to database");
                return;
            }
            if (res.docs && (res.docs.length == 1)) {
                const updatedBlog = {
                    blogHeader: blogHeader,
                    blogContent: blogContent,
                    _id: res.docs[0]._id,
                    _rev: res.docs[0]._rev,
                    createdAt: res.docs[0].createdAt,
                    totalComments: res.docs[0].totalComments,
                    comments: res.docs[0].comments
                };
                mydb.insert(updatedBlog, function (err, body, header) {
                    if (err) {
                        console.log('[mydb.insert] ', err.message);
                        response.send("Error in updating blog");
                        return;
                    }
                    const res = {
                        "status": "SUCCESS",
                        "message": "Blog updated successfully"
                    }
                    response.send(res);
                });
            } else {
                console.log({
                    "Error": "Blog not found"
                })
                response.status(404).send({
                    "Error": "Blog not found"
                });
            }
        });
    } else {
        console.log({
            "Error": "Missing parameter"
        })
        response.status(400).send({
            "Error": "Missing parameter"
        });
    }
});

app.post("/deleteBlog", (request, response) => {
    var blogId = request.body._id;
    var updatedComments;
    if (blogId) {
        if (!mydb) {
            console.log("No database.");
            response.status(500).send("Database connection is not ready");
            return;
        }
        mydb.find({
            "selector": {
                "_id": blogId
            }
        }, (er, res) => {
            if (er) {
                console.log('Query Error', er.message);
                response.status(503).send("Too many request to database");
                return;
            }
            if (res.docs && (res.docs.length == 1)) {
                mydb.destroy(res.docs[0]._id, res.docs[0]._rev, function (err, body, header) {
                    if (err) {
                        console.log('[mydb.insert] ', err.message);
                        response.send("Error in deleting blog");
                        return;
                    }
                    const res = {
                        "status": "SUCCESS",
                        "message": "Blog deleted successfully"
                    }
                    response.send(res);
                });
            } else {
                console.log({
                    "Error": "Blog not found"
                })
                response.status(404).send({
                    "Error": "Blog not found"
                });
            }
        });
    } else {
        console.log({
            "Error": "Missing parameter"
        })
        response.status(400).send({
            "Error": "Missing parameter"
        });
    }
});

async function generateCommentId(blogId) {
    var newCommentId;
    newCommentId = await generateCommentIdNew(blogId);
    console.log(newCommentId);
    return newCommentId;
}

function padStart(str, targetLength, padString) {
    if (isInteger(targetLength) && targetLength > 1) {
        padString = String(typeof padString !== 'undefined' ? padString : ' ');
        if (str.length >= targetLength) {
            return str;
        } else {
            targetLength = targetLength - str.length;
            if (targetLength > padString.length) {
                padString += padString.repeat(targetLength / padString.length); // append to original to ensure we are longer than needed
            }
            return padString.slice(0, targetLength) + str;
        }
    } else {
        return str;
    }
}

function isInteger(value) {
    return typeof value === 'number' &&
        isFinite(value) &&
        Math.floor(value) === value;
}

function generateCommentIdNew(blogId) {
    var ind;
    var commentPresent = false;
    var lastCommentId;
    var newCommentId;
    var blogIndex, subString, k;
    var newPromise = new Promise((resolve, reject) => {
        mydb.list({
            include_docs: true
        }, function (err, body) {
            if (!err) {
                body.rows.filter(function (blog) {
                    if (blog.doc._id === blogId) {
                        blogIndex = blog.doc._id.toString();
                        subString = blogIndex.substring(blogIndex.length - 5);
                        ind = subString.toUpperCase();
                        if (blog.doc.comments.length > 0) {
                            commentPresent = true;
                            k = blog.doc.comments.length;
                            lastCommentId = blog.doc.comments[k - 1]._id;
                        } else {
                            commentPresent = false;
                        }
                    }
                });
                if (commentPresent) {
                    const splittedString = lastCommentId.split('COM');
                    const newIndex = parseInt(splittedString[1]) + 1;
                    newCommentId = 'BL' + ind + 'COM' + padStart(newIndex.toString(), 3, '0');
                    resolve(newCommentId);
                } else {
                    newCommentId = 'BL' + ind + 'COM' + '001';
                    resolve(newCommentId)
                }
            }
        });
    });
    return newPromise;
}

module.exports = app;