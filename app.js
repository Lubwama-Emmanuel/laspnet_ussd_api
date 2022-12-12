const express = require("express");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const path = require("path");

const xss = require("xss-clean");
const hpp = require("hpp");

const AppError = require("./utils/appError");
const globalErrorHandler = require("./controllers/errorController");
const registrationRouter = require("./routes/registrationRoutes");
const paralegalAccountRouter = require("./routes/paralegalAccountRoutes");
const iimsRouter = require("./routes/iimsRoutes");
const ussdRouter = require("./routes/ussdRoutes");
const compression = require("compression");
// const reviewRouter = require('./routes/reviewRoutes');
const app = express();
const cors = require("cors");

app.use(helmet());
app.use(
  cors({
    credentials: true,
  })
);
app.options("*", cors());

// Development logging
// if (process.env.NODE_ENV === "development") {
app.use(morgan("dev"));
// }

// Limit requests from same API
const limiter = rateLimit({
  max: 20000,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests from this IP, please try again in an hour!",
});
app.use("/api", limiter);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: "12609009kb" }));
// app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: "12609009kb" }));

// Data sanitization against XSS
app.use(xss());
app.use(express.static(path.join(__dirname, "public")));

app.use(compression());
// Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();

  next();
});

// 3) ROUTES

app.use("/api/v1/registration", registrationRouter);
app.use("/api/v1/paralegalAccount", paralegalAccountRouter);
app.use("/api/v1", iimsRouter);
app.use("/api/v1/paralegals",ussdRouter)

app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
