import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ layoutId: string }> }
) {
  const { layoutId } = await params;
  const body = await request.json();

  const layout = await db.generatedLayout.update({
    where: { id: layoutId },
    data: {
      ...(body.imageUrl  !== undefined && { imageUrl:  body.imageUrl }),
      ...(body.copyText  !== undefined && { copyText:  body.copyText }),
      ...(body.isSelected !== undefined && { isSelected: body.isSelected }),
      ...(body.savedToLibrary !== undefined && { savedToLibrary: body.savedToLibrary }),
    },
  });

  return NextResponse.json(layout);
}
