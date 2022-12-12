
const dotenv = require('dotenv');
const app = require('./app');
const connection = require('./utils/config')
process.on('uncaughtException', err => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: './config.env' });

const DB = process.env.DATABASE_LOCAL;
 
const connectDb = async()=>{
  const conection = await connection._connect();
  console.log("successfully connected to db")
}


const port = process.env.PORT || 3000; 
const server = app.listen(port, () => {
  console.log(`App running on port ${port}...`);
  // connectDb()
});

process.on('unhandledRejection', err => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
