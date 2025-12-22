// API Response types

export interface ScrapeResponse {
  success: boolean;
  data?: {
    title: string;
    description: string;
    content: string;
  };
  error?: string;
}

export interface GenerateDescriptionResponse {
  success: boolean;
  description?: string;
  category?: string;
  error?: string;
}

export interface GenerateTopicsResponse {
  success: boolean;
  topics?: string[];
  error?: string;
}

export interface GenerateCompetitorsResponse {
  success: boolean;
  competitors?: {
    name: string;
    website?: string;
  }[];
  error?: string;
}

export interface SimulateSearchResponse {
  success: boolean;
  results?: {
    query: string;
    response: string;
    brands: {
      name: string;
      position: number;
      sentiment: string;
    }[];
  }[];
  error?: string;
}
