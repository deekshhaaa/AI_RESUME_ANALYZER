// pdfToImage.ts

export interface PdfConversionResult {
    imageUrl: string;
    file: File | null;
    error?: string;
}

let pdfjsLib: any = null;
let loadPromise: Promise<any> | null = null;

/**
 * Dynamically loads pdfjs-dist in the browser and configures the worker.
 * Works with pdfjs-dist@4.x
 */
async function loadPdfJs(): Promise<any> {
    if (typeof window === "undefined") {
        throw new Error("PDF conversion can only run in the browser.");
    }

    if (pdfjsLib) return pdfjsLib;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
        // Import the main pdfjs library (ESM entry)
        const mod: any = await import("pdfjs-dist");

        // Some bundlers put everything on `default`, some do not
        const lib = mod?.default ?? mod;

        // ⚙️ Try: use worker from the package itself
        try {
            const workerModule: any = await import("pdfjs-dist/build/pdf.worker.mjs");
            // In many setups workerModule.default is the URL / worker script
            lib.GlobalWorkerOptions.workerSrc = workerModule.default ?? workerModule;
        } catch (e) {
            // 🔁 Fallback: use worker from public folder
            // Make sure you have /public/pdf.worker.min.mjs copied from node_modules
            console.warn(
                "[pdfToImage] Falling back to /pdf.worker.min.mjs for worker. " +
                    "Ensure this file exists in your public folder."
            );
            lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        }

        pdfjsLib = lib;
        return lib;
    })();

    return loadPromise;
}

/**
 * Converts the **first page** of a PDF File to a PNG image.
 */
export async function convertPdfToImage(file: File): Promise<PdfConversionResult> {
    try {
        const lib = await loadPdfJs();

        const arrayBuffer = await file.arrayBuffer();

        // Load the PDF document
        const loadingTask = lib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        // Get first page
        const page = await pdf.getPage(1);

        // Adjust scale if needed (4 = high resolution, but heavier)
        const viewport = page.getViewport({ scale: 3 });

        // Prepare canvas
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
            return {
                imageUrl: "",
                file: null,
                error: "Failed to get 2D context from canvas.",
            };
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Optional quality tweaks
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";

        // Render the PDF page into the canvas
        await page.render({
            canvasContext: context,
            viewport,
        }).promise;

        // Convert canvas to Blob and then to File
        return new Promise<PdfConversionResult>((resolve) => {
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        resolve({
                            imageUrl: "",
                            file: null,
                            error: "Failed to create image blob from canvas.",
                        });
                        return;
                    }

                    const originalName = file.name.replace(/\.pdf$/i, "");
                    const imageFile = new File([blob], `${originalName}.png`, {
                        type: "image/png",
                    });

                    const imageUrl = URL.createObjectURL(blob);

                    resolve({
                        imageUrl,
                        file: imageFile,
                    });
                },
                "image/png",
                1.0 // max quality
            );
        });
    } catch (err: any) {
        console.error("PDF → Image conversion error:", err);

        return {
            imageUrl: "",
            file: null,
            error: `Failed to convert PDF: ${err?.message ?? String(err)}`,
        };
    }
}
