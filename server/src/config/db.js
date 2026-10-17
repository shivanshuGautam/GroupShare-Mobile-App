const mongoose = require("mongoose");

let isConnected = false;

const connectDB = async () => {
  const rawUri =
    process.env.MONGO_DB_URI ||
    process.env.MONGO_URI ||
    "mongodb://localhost:27017/groupshare_mobile_DB";
  const uri = rawUri.trim().replace(/^['"]|['"]$/g, '');

  try {
    const conn = await mongoose.connect(uri);
    isConnected = true;
    console.log(" MongoDB connected Successfully");
    console.log(` DB Host : ${conn.connection.host}`);
    console.log(` DB Name : ${conn.connection.name}`);
    return conn;
  } catch (error) {
    isConnected = false;
    console.warn(` MongoDB Connection Warning: ${error.message}`);
    console.warn(" Running with In-Memory Demo Store fallback.");
  }
};

const getDbStatus = () => isConnected;

module.exports = {
  connectDB,
  getDbStatus,
  default: connectDB,
};
