import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global Middlewares
  app.use(helmet());
  app.enableCors({
    origin: "*", // Adjust for production environments
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
  });

  // Global Pipes & Interceptors
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger Compilation Setup
  const config = new DocumentBuilder()
    .setTitle("BlackTicket Secure Resale MVP Backend")
    .setDescription("Production-grade, highly cost-optimized API desk orchestrating movie tickets peer-to-peer secure resales.")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api-docs", app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`[BLACKTICKET] MVP Backend successfully running on http://localhost:${port}`);
  console.log(`[BLACKTICKET] Interactive API Swagger Docs available at http://localhost:${port}/api-docs`);
}
bootstrap();
