import express, { Request, Response } from "express";
import cors from "cors";
import prisma from "./db";
import authRouter from "./routes/auth";
import metroRouter from "./routes/metro";
import bookingRouter from "./routes/booking";
import { buildGraph } from "./services/graph";

const app = express()

// CORS: only allow specific frontends
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173')
    .split(',')
    .map(s => s.trim());

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (Postman, curl, server-to-server)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));

app.use(express.json());

const port = process.env.PORT || 3000

app.use('/auth', authRouter);
app.use('/metro', metroRouter);
app.use('/booking', bookingRouter);

app.get('/', (req: Request, res: Response) => {
    res.json({
        message: "Hello World"
    })
})

app.get('/test-health', async (req: Request, res: Response) => {
    try {
        // console.log("checking health")
        const result: any[] = await prisma.$queryRaw`SELECT NOW()`;
        res.status(200).json({
            message: "Database is working",
            time: result[0].now
        })
    } catch (err) {
        console.log(err);
        res.status(500).json({
            message: "Database is not working"
        })
    }
})

app.listen(port, async () => {
    console.log(`Server is running on port ${port}`)

    // Build the metro graph on startup
    try {
        await buildGraph();
        console.log('[Startup] Metro graph loaded successfully');
    } catch (err) {
        console.error('[Startup] Failed to build metro graph:', err);
        console.log('[Startup] Route finding will not work until graph is refreshed');
    }
})