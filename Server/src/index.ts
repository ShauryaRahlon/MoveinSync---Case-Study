import express, { Request, Response } from "express";
import prisma from "./db";

const app = express()

const port = process.env.PORT || 3000

app.get('/', (req: Request, res: Response) => {
    res.json({
        message: "Hello World"
    })
})

app.get('/test-health', async (req: Request, res: Response) => {
    try {
        // console.log("checking health")
        const result: any[] = await prisma.$queryRaw`SELECT NOW()`;
        res.json({
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

app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})