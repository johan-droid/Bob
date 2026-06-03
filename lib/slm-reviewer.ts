/**
 * Lightweight SLM (Small Language Model) AI Code Review Adapter
 * 
 * This module hooks into free API endpoints (OpenRouter, HuggingFace) to provide
 * automated code review comments when CI builds fail. It fetches raw terminal logs,
 * isolates compile errors, and posts contextual summaries to PRs.
 */

import { PRHealthScanner } from './scanner';
import { get, run } from './db';
import { decryptToken } from './auth';

// Configuration for SLM providers
export interface SLMConfig {
  // Provider selection: 'openrouter' | 'huggingface' | 'ollama'
  provider: string;
  
  // API key for the selected provider
  apiKey: string;
  
  // Model to use (varies by provider)
  model: string;
  
  // Maximum tokens for response
  maxTokens: number;
  
  // Temperature for generation
  temperature: number;
  
  // Timeout in ms
  timeout: number;
}

// Default configurations for different providers
const PROVIDER_CONFIGS: Record<string, Partial<SLMConfig>> = {
  openrouter: {
    model: process.env.SLM_MODEL || 'google/gemma-2-2b-it:free',
    maxTokens: 500,
    temperature: 0.3,
    timeout: 15000
  },
  huggingface: {
    model: process.env.SLM_MODEL || 'mistralai/Mistral-7B-Instruct-v0.3',
    maxTokens: 500,
    temperature: 0.3,
    timeout: 20000
  },
  ollama: {
    model: process.env.SLM_MODEL || 'llama3.2:1b',
    maxTokens: 500,
    temperature: 0.3,
    timeout: 30000
  }
};

// Default config
const DEFAULT_CONFIG: SLMConfig = {
  provider: process.env.SLM_PROVIDER || 'openrouter',
  apiKey: process.env.SLM_API_KEY || '',
  model: 'google/gemma-2-2b-it:free',
  maxTokens: 500,
  temperature: 0.3,
  timeout: 15000
};

export class SLMCodeReviewer {
  private config: SLMConfig;
  private scanner: PRHealthScanner;

  constructor(config?: Partial<SLMConfig>, scanner?: PRHealthScanner) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Apply provider-specific defaults
    const providerDefaults = PROVIDER_CONFIGS[this.config.provider] || {};
    this.config = { ...this.config, ...providerDefaults };
    
    this.scanner = scanner || new PRHealthScanner('', []);
  }

  /**
   * Fetch workflow run logs from GitHub
   */
  async fetchWorkflowLogs(repo: string, runId: number): Promise<string> {
    const logsUrl = `https://api.github.com/repos/${repo}/actions/runs/${runId}/logs`;
    
    try {
      const response = await fetch(logsUrl, {
        headers: {
          'Authorization': `token ${this.scanner['token']}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Bob-SLM-Code-Reviewer'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch logs: HTTP ${response.status}`);
      }

      // GitHub returns logs as a zip file, but we'll get the text logs endpoint
      // Alternative: use the jobs endpoint to get individual job logs
      const jobsResponse = await fetch(
        `https://api.github.com/repos/${repo}/actions/runs/${runId}/jobs`,
        {
          headers: {
            'Authorization': `token ${this.scanner['token']}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Bob-SLM-Code-Reviewer'
          }
        }
      );

      if (!jobsResponse.ok) {
        throw new Error(`Failed to fetch jobs: HTTP ${jobsResponse.status}`);
      }

      const jobsData = await jobsResponse.json();
      let allLogs = '';

      for (const job of jobsData.jobs || []) {
        const jobLogsResponse = await fetch(job.logs_url, {
          headers: {
            'Authorization': `token ${this.scanner['token']}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Bob-SLM-Code-Reviewer'
          }
        });

        if (jobLogsResponse.ok) {
          const logs = await jobLogsResponse.text();
          allLogs += `\n\n## Job: ${job.name}\n${logs}`;
        }
      }

      return allLogs || 'No logs available';
    } catch (error: any) {
      console.error('Error fetching workflow logs:', error);
      return `Error fetching logs: ${error.message}`;
    }
  }

  /**
   * Extract error messages from raw logs
   */
  extractErrors(logs: string): { errorMessage: string; context: string; severity: string }[] {
    const errors: Array<{ errorMessage: string; context: string; severity: string }> = [];
    
    // Common error patterns
    const errorPatterns = [
      { pattern: /error[:\s]+(.+)/gi, severity: 'error' },
      { pattern: /ERROR[:\s]+(.+)/gi, severity: 'error' },
      { pattern: /failed[:\s]+(.+)/gi, severity: 'error' },
      { pattern: /FAILED[:\s]+(.+)/gi, severity: 'error' },
      { pattern: /exception[:\s]+(.+)/gi, severity: 'error' },
      { pattern: /panic[:\s]+(.+)/gi, severity: 'error' },
      { pattern: /warning[:\s]+(.+)/gi, severity: 'warning' },
      { pattern: /WARNING[:\s]+(.+)/gi, severity: 'warning' },
      { pattern: /cannot find module['"](.+)['"]/gi, severity: 'error' },
      { pattern: /ModuleNotFoundError[:\s]+(.+)/gi, severity: 'error' },
      { pattern: /SyntaxError[:\s]+(.+)/gi, severity: 'error' },
      { pattern: /TypeError[:\s]+(.+)/gi, severity: 'error' },
      { pattern: /ReferenceError[:\s]+(.+)/gi, severity: 'error' },
      { pattern: /build failed/gi, severity: 'error' },
      { pattern: /compilation failed/gi, severity: 'error' },
      { pattern: /test.*failed/gi, severity: 'error' },
    ];

    const lines = logs.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      for (const { pattern, severity } of errorPatterns) {
        const match = pattern.exec(line);
        if (match) {
          // Get context (surrounding lines)
          const start = Math.max(0, i - 2);
          const end = Math.min(lines.length, i + 3);
          const context = lines.slice(start, end).join('\n');
          
          errors.push({
            errorMessage: match[0].trim(),
            context: context.trim(),
            severity
          });
          
          break; // Avoid duplicate matches for same line
        }
      }
    }

    // Deduplicate similar errors
    const uniqueErrors = errors.filter((err, idx, self) => 
      idx === self.findIndex(e => e.errorMessage === err.errorMessage)
    );

    return uniqueErrors.slice(0, 10); // Limit to top 10 errors
  }

  /**
   * Generate AI summary for errors using SLM
   */
  async generateSummary(errors: Array<{ errorMessage: string; context: string; severity: string }>, repo: string): Promise<string> {
    if (errors.length === 0) {
      return '✅ No critical errors detected in the build logs.';
    }

    // Construct prompt for the SLM
    const prompt = `You are a helpful code review assistant. Analyze these CI/CD build errors and provide a concise, actionable summary.

Repository: ${repo}

Build Errors Found:
${errors.map((e, i) => `
${i + 1}. [${e.severity.toUpperCase()}] ${e.errorMessage}
   Context:
${e.context.split('\n').map(l => '   ' + l).join('\n')}
`).join('\n')}

Provide a brief summary (max 3 sentences) explaining:
1. What likely caused the failure
2. Specific files or code areas affected (if identifiable)
3. Suggested fix approach

Keep it concise and developer-friendly.`;

    try {
      const summary = await this.callSLM(prompt);
      
      return `🤖 **AI Code Review Summary**\n\n${summary}\n\n---\n*This is an automated analysis. Please verify suggestions before applying.*`;
    } catch (error: any) {
      console.error('SLM summary generation failed:', error);
      
      // Fallback to manual summary
      return this.generateFallbackSummary(errors);
    }
  }

  /**
   * Call the configured SLM provider
   */
  private async callSLM(prompt: string): Promise<string> {
    const { provider, apiKey, model, maxTokens, temperature, timeout } = this.config;

    if (!apiKey && provider !== 'ollama') {
      throw new Error(`API key required for ${provider}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      let response: Response;

      switch (provider) {
        case 'openrouter':
          response = await this.callOpenRouter(prompt, model!, maxTokens!, temperature!, apiKey, controller.signal);
          break;
        case 'huggingface':
          response = await this.callHuggingFace(prompt, model!, maxTokens!, temperature!, apiKey, controller.signal);
          break;
        case 'ollama':
          response = await this.callOllama(prompt, model!, maxTokens!, temperature!, controller.signal);
          break;
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }

      clearTimeout(timeoutId);
      return await response.text();
    } catch (error: any) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Call OpenRouter API (supports many free models)
   */
  private async callOpenRouter(
    prompt: string,
    model: string,
    maxTokens: number,
    temperature: number,
    apiKey: string,
    signal: AbortSignal
  ): Promise<Response> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.PUBLIC_BASE_URL || 'http://localhost:3000',
        'X-Title': 'Bob PR Health Scanner'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature
      }),
      signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return new Response(data.choices?.[0]?.message?.content || 'Unable to generate summary');
  }

  /**
   * Call HuggingFace Inference API
   */
  private async callHuggingFace(
    prompt: string,
    model: string,
    maxTokens: number,
    temperature: number,
    apiKey: string,
    signal: AbortSignal
  ): Promise<Response> {
    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: maxTokens,
          temperature,
          return_full_text: false
        }
      }),
      signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HuggingFace API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const generatedText = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text || '';
    return new Response(generatedText || 'Unable to generate summary');
  }

  /**
   * Call local Ollama instance
   */
  private async callOllama(
    prompt: string,
    model: string,
    maxTokens: number,
    temperature: number,
    signal: AbortSignal
  ): Promise<Response> {
    const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
    
    const response = await fetch(`${ollamaHost}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          num_predict: maxTokens,
          temperature
        }
      }),
      signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return new Response(data.response || 'Unable to generate summary');
  }

  /**
   * Fallback summary when SLM is unavailable
   */
  private generateFallbackSummary(errors: Array<{ errorMessage: string; context: string; severity: string }>): string {
    const errorCount = errors.filter(e => e.severity === 'error').length;
    const warningCount = errors.filter(e => e.severity === 'warning').length;

    let summary = `⚠️ **Build Analysis**\n\n`;
    summary += `Found ${errorCount} error(s) and ${warningCount} warning(s).\n\n`;
    summary += `**Top Issues:**\n`;
    
    errors.slice(0, 5).forEach((e, i) => {
      summary += `${i + 1}. \`${e.errorMessage.substring(0, 80)}${e.errorMessage.length > 80 ? '...' : ''}\`\n`;
    });

    summary += `\nPlease check the build logs for more details.`;
    
    return summary;
  }

  /**
   * Post comment to GitHub PR
   */
  async postComment(repo: string, prNumber: number, comment: string): Promise<boolean> {
    try {
      const result = await this.scanner.createComment(repo, prNumber, comment);
      
      if (result && (result.id || result.url)) {
        console.log(`Posted AI review comment to ${repo}#${prNumber}`);
        return true;
      }
      
      console.warn('Failed to post comment:', result);
      return false;
    } catch (error: any) {
      console.error('Error posting comment:', error);
      return false;
    }
  }

  /**
   * Main entry point: Process a CI failure and post AI review
   */
  async reviewCIFailure(userId: number, repo: string, runId: number, prNumber?: number): Promise<{ success: boolean; summary?: string; error?: string }> {
    try {
      // Get user token
      const user = await get('SELECT * FROM users WHERE id = $1', [userId]);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const decryptedToken = decryptToken(user.access_token);
      if (!decryptedToken) {
        return { success: false, error: 'Unable to decrypt token' };
      }

      // Initialize scanner with user's token
      this.scanner = new PRHealthScanner(decryptedToken, [repo]);

      // Fetch workflow logs
      console.log(`Fetching logs for ${repo} run #${runId}...`);
      const logs = await this.fetchWorkflowLogs(repo, runId);

      // Extract errors
      console.log('Extracting errors from logs...');
      const errors = this.extractErrors(logs);

      if (errors.length === 0) {
        return { success: true, summary: 'No errors found in logs' };
      }

      // Generate AI summary
      console.log('Generating AI summary...');
      const summary = await this.generateSummary(errors, repo);

      // Post to PR if number is available
      if (prNumber) {
        console.log(`Posting comment to ${repo}#${prNumber}...`);
        const posted = await this.postComment(repo, prNumber, summary);
        
        if (posted) {
          // Log the action
          await run(
            `INSERT INTO ai_review_logs (user_id, repo, pr_number, run_id, created_at, summary_preview) 
             VALUES ($1, $2, $3, $4, $5, $5)
             ON CONFLICT DO NOTHING`,
            [userId, repo, prNumber, runId, new Date().toISOString(), summary.substring(0, 200)]
          );
        }
        
        return { success: posted, summary };
      }

      return { success: true, summary };
    } catch (error: any) {
      console.error('SLM code review failed:', error);
      return { success: false, error: error.message };
    }
  }
}

/**
 * Auto-trigger SLM review on CI failure detection
 * This can be called from the scan pipeline when workflow failures are detected
 */
export async function triggerAIReviewOnCIFailure(
  userId: number,
  repo: string,
  runId: number,
  prNumber?: number
): Promise<void> {
  const reviewer = new SLMCodeReviewer();
  
  try {
    const result = await reviewer.reviewCIFailure(userId, repo, runId, prNumber);
    
    if (result.success) {
      console.log(`AI review completed for ${repo}#${prNumber || runId}`);
    } else {
      console.warn(`AI review failed: ${result.error}`);
    }
  } catch (error) {
    console.error('AI review trigger failed:', error);
  }
}

export default SLMCodeReviewer;
