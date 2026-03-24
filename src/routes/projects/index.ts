import type { FastifyInstance } from "fastify";
import { createProjectRoute } from "./create.js";
import { listProjectsRoute } from "./list.js";
import { getProjectRoute } from "./get.js";
import { getProjectDesignsRoute } from "./designs.js";
import { getGenerationStatusRoute } from "./generation-status.js";

export async function projectRoutes(fastify: FastifyInstance) {
  // POST /api/projects — Create a new project
  await fastify.register(createProjectRoute);

  // GET /api/projects — List user's projects
  await fastify.register(listProjectsRoute);

  // GET /api/projects/:id — Get a single project with details
  await fastify.register(getProjectRoute);

  // GET /api/projects/:id/designs — List designs for a project
  await fastify.register(getProjectDesignsRoute);

  // GET /api/projects/:id/generation-status — Poll suite generation progress
  await fastify.register(getGenerationStatusRoute);
}
