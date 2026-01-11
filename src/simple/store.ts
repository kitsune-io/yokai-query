import { QueryClientConfigUpdate } from "../types";
import { createQueryClient } from "../store";

export const createDefaultClient = (overrides?: QueryClientConfigUpdate) =>
  createQueryClient(overrides);
