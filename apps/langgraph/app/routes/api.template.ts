import { json } from '@remix-run/node';
import type { LoaderFunction } from '@remix-run/node';
import { Template } from '@langgraph/models/template';
import { type FileMap } from '@models/file';
interface TemplateResponse {
  files: FileMap;
}

export const loader: LoaderFunction = async ({ params }) => {
  const templateId = params.templateId || 'default';
  
  try {
    const template = await Template.getTemplate(templateId);
    const files = template.files;
    
    const response: TemplateResponse = { files };
    return json(response);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new Response(error.message, { status: 404 });
    }
    throw error;
  }
};
