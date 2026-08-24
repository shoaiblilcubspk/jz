import { useBarcodeSettings } from './useBarcodeSettings';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, Minus, Plus, X, Maximize2 } from 'lucide-react';
import { Product } from '../../../types';
import { Button, Badge } from '../../../shared/ui';
import { BarcodeCard } from './BarcodeCard';
import { BarcodeSidebar } from './BarcodeSidebar';

interface BarcodeGeneratorProps {
    products: Product[];
    onClose: () => void;
    onProductsChange?: (nextProducts: Product[]) => void;
}

const A4_W = 794;
const A4_H = 1123;

export let persistedBarcodeProducts: Product[] = [];
export let persistedBarcodeQuantities: Record<string, number> = {};

export function clearPersistedBarcodeState() {
    persistedBarcodeProducts = [];
    persistedBarcodeQuantities = {};
}

export function BarcodeGenerator({ products, onClose, onProductsChange }: BarcodeGeneratorProps) {
    const settings = useBarcodeSettings();
    const {
        paperSize, a4Columns, a4Rows,
        barcodeScale, barcodeHeight,
        labelPadding, labelBorder,
        showBarcode, showQr, qrSize, nameLines, barcodeFontSize, contentScale,
        marginX, marginY, gapX, gapY, barcodeBarWidth, barcodeZoom,
        showPrice, showName, showCategory, showSku, appSettings
    } = settings;

    const [localProducts, setLocalProducts] = useState<Product[]>(() => {
        return persistedBarcodeProducts.length > 0 ? persistedBarcodeProducts : products;
    });
    const [quantities, setQuantities] = useState<Record<string, number>>(() => {
        if (Object.keys(persistedBarcodeQuantities).length > 0) return persistedBarcodeQuantities;
        const q: Record<string, number> = {};
        products.forEach(p => { q[p.id] = 1; });
        return q;
    });

    useEffect(() => {
        persistedBarcodeProducts = localProducts;
        persistedBarcodeQuantities = quantities;
        if (onProductsChange) onProductsChange(localProducts);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [localProducts, quantities]);

    useEffect(() => {
        if (products.length > 0 && localProducts.length === 0) {
            setLocalProducts(products);
            const q: Record<string, number> = {};
            products.forEach(p => { q[p.id] = 1; });
            setQuantities(q);
        }
    }, [products]);

    const updateQty = (id: string, qty: number) => setQuantities(prev => ({ ...prev, [id]: Math.max(0, qty) }));
    const setGlobalQty = (qty: number) => {
        const q: Record<string, number> = {};
        localProducts.forEach(p => { q[p.id] = qty; });
        setQuantities(q);
    };

    const isThermal = paperSize !== 'A4';
    const pad = labelPadding;
    const ratio = contentScale;
    const fs = barcodeFontSize;
    const barH = barcodeHeight;

    const totalLabels = localProducts.reduce((sum, p) => sum + (quantities[p.id] || 0), 0);

    const allLabels: { product: Product, id: string }[] = [];
    localProducts.forEach(p => {
        const q = quantities[p.id] || 0;
        for (let i = 0; i < q; i++) {
            allLabels.push({ product: p, id: `${p.id}-${i}` });
        }
    });

    const labelsPerPage = a4Columns * a4Rows;
    const pages: typeof allLabels[] = [];
    if (!isThermal) {
        for (let i = 0; i < allLabels.length; i += labelsPerPage) {
            pages.push(allLabels.slice(i, i + labelsPerPage));
        }
    } else {
        pages.push(allLabels); // Thermal is just one continuous list
    }

    const [autoScale, setAutoScale] = useState(1);
    const [zoomDelta, setZoomDelta] = useState(0);
    const previewScale = autoScale + zoomDelta;

    const previewAreaRef = useRef<HTMLDivElement>(null);
    const componentRef = useRef<HTMLDivElement>(null);

    const calcAutoScale = useCallback(() => {
        if (!previewAreaRef.current) return;
        const w = previewAreaRef.current.clientWidth;
        const targetW = isThermal ? (paperSize === '58mm' ? 220 : 300) : A4_W;
        const padding = 40;
        const scale = Math.min(1, (w - padding) / targetW);
        setAutoScale(scale);
        setZoomDelta(0);
    }, [isThermal, paperSize]);

    useEffect(() => {
        calcAutoScale();
        window.addEventListener('resize', calcAutoScale);
        return () => window.removeEventListener('resize', calcAutoScale);
    }, [calcAutoScale]);

    const getPageStyle = () => {
        if (paperSize === 'A4') {
            return `@page { size: A4 portrait; margin: 0; }`;
        }
        const match = paperSize.match(/Thermal-(\d+)x(\d+)/);
        if (match) {
            return `@page { size: ${match[1]}mm ${match[2]}mm; margin: 0; } body { margin: 0; }`;
        }
        return `@page { margin: 0; }`;
    };

    const handlePrintFn = useReactToPrint({
        content: () => componentRef.current,
        documentTitle: `Barcodes_${new Date().getTime()}`,
        pageStyle: getPageStyle(),
    });

    const handlePrint = () => {
        if (totalLabels > 0 && handlePrintFn) {
            handlePrintFn();
        }
    };

    const cellW = isThermal ? '100%' : `${100 / a4Columns}%`;
    const cellH = isThermal ? 'auto' : `${100 / a4Rows}%`;

    const renderCard = (product: Product, labelId: string) => (
        <BarcodeCard
            key={labelId}
            product={product}
            labelId={labelId}
            isThermal={isThermal}
            paperSize={paperSize}
            labelBorder={labelBorder}
            currency={appSettings.currency}
            pad={pad}
            ratio={ratio}
            fs={fs}
            barH={barH}
            barcodeBarWidth={barcodeBarWidth}
            barcodeScale={barcodeScale}
            barcodeZoom={barcodeZoom}
            barcodeFontSize={barcodeFontSize}
            showBarcode={showBarcode}
            showQr={showQr}
            showName={showName}
            showPrice={showPrice}
            showCategory={showCategory}
            showSku={showSku}
            nameLines={nameLines}
            qrSz={qrSize}
            previewScale={previewScale}
            cellW={cellW}
            cellH={cellH}
            marginX={marginX}
            marginY={marginY}
        />
    );

    return (
        <div className="flex flex-col h-full min-h-[600px] w-full bg-white dark:bg-surface overflow-hidden relative border-t border-gray-100 dark:border-white/5">

            <div className="flex-shrink-0 flex items-center justify-between gap-2 px-3 md:px-5 py-2.5 border-b border-gray-200 dark:border-white/5 bg-gray-50/60 dark:bg-white/[0.02] flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 bg-blue-600/10 rounded-lg flex-shrink-0">
                        <Printer className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm font-black text-gray-900 dark:text-white leading-none truncate">{"Barcode Print Engine"}</h2>
                        <p className="hidden sm:block text-[9px] text-gray-600 mt-0.5 truncate">{"Barcode Print Engine Sub"}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge
                        tone={totalLabels === 0 ? 'neutral' : 'info'}
                        size="md"
                        className={`hidden sm:inline-flex !rounded-lg !px-2.5 !py-1 !text-[9px] !font-bold ${totalLabels === 0
                            ? '!bg-gray-50 dark:!bg-white/5 !text-gray-600 !border-gray-200 dark:!border-white/5'
                            : '!bg-blue-50 dark:!bg-blue-600/10 !text-blue-700 dark:!text-blue-400 !border-blue-200 dark:!border-blue-900/30'}`}
                    >
                        {"labels_pages_count".replace('{totalLabels}', totalLabels.toString()).replace('{pages}', pages.length.toString())}
                    </Badge>
                    <Button
                        onClick={handlePrint}
                        disabled={totalLabels === 0}
                        className="!h-9 !min-h-0 !px-4 !gap-1.5 !text-[10px] !font-black !shadow-md !shadow-blue-500/20 whitespace-nowrap"
                        icon={<Printer className="h-3.5 w-3.5 flex-shrink-0" />}
                    >
                        <span className="hidden xs:inline">{"Print And Save"}</span>
                        <span className="xs:hidden">{"print"}</span>
                    </Button>
                    <Button variant="ghost" onClick={onClose} className="!min-h-0 !p-1.5 !rounded-lg !text-gray-600 hover:!text-gray-700 dark:hover:!text-white hover:!bg-gray-100 dark:hover:!bg-white/5" icon={<X className="h-4.5 w-4.5" />} />
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">

                <BarcodeSidebar
                    settings={settings}
                    localProducts={localProducts}
                    setLocalProducts={setLocalProducts}
                    quantities={quantities}
                    setQuantities={setQuantities}
                    updateQty={updateQty}
                    setGlobalQty={setGlobalQty}
                />

                <div ref={previewAreaRef}
                    className="h-[35vh] lg:h-full lg:flex-1 flex-shrink-0 bg-gray-100 dark:bg-[#0f0f0f] flex flex-col overflow-hidden order-1 lg:order-2 relative min-h-0"
                >

                    <div className="flex-shrink-0 flex items-center justify-between gap-2 px-3 py-2 bg-gray-100/95 dark:bg-[#0f0f0f]/95 border-b border-gray-200/50 dark:border-white/5 flex-wrap gap-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="flex items-center gap-1.5 bg-white/80 dark:bg-white/5 py-1 px-2.5 rounded-full border border-gray-200 dark:border-white/5 shadow-sm">
                                <span className="text-[8px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest whitespace-nowrap hidden sm:inline">{"simulation"}</span>
                                <div className="hidden sm:block h-2 w-px bg-gray-300 dark:bg-white/10" />
                                <span className="text-[9px] font-black text-blue-600 uppercase">{paperSize}</span>
                                <div className="h-2 w-px bg-gray-300 dark:bg-white/10" />
                                <span className="text-[9px] font-black text-primary">{pages.length}pg</span>
                                <div className="h-2 w-px bg-gray-300 dark:bg-white/10" />
                                <span className="text-[9px] font-black text-gray-600">{a4Columns}×{a4Rows}</span>
                            </div>
                            <Badge tone="warning" className="!bg-amber-500/10 !text-amber-600 dark:!text-amber-400 !text-[8px] !px-2.5 !py-1 !rounded-full !border-amber-500/20 hidden sm:inline-flex">
                                ⚠ {"Margins None"}
                            </Badge>
                        </div>

                        <div className="flex items-center gap-2 bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 p-1.5 px-3 shadow-sm">
                            <Button
                                variant="ghost"
                                onClick={() => setZoomDelta(d => Math.max(d - 0.05, -autoScale + 0.1))}
                                className="!min-h-0 !w-6 !h-6 !p-0 !rounded-lg !bg-transparent !text-gray-500 hover:!text-gray-900 dark:hover:!text-white hover:!bg-gray-100 dark:hover:!bg-white/10 active:!scale-90"
                                icon={<Minus className="h-3 w-3" />}
                            />

                            <input
                                type="range"
                                min={-autoScale + 0.1}
                                max={2.5 - autoScale}
                                step={0.01}
                                value={zoomDelta}
                                onChange={(e) => setZoomDelta(parseFloat(e.target.value))}
                                className="w-20 sm:w-32 h-1 bg-gray-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />

                            <Button
                                variant="ghost"
                                onClick={() => setZoomDelta(d => Math.min(d + 0.05, 2.5 - autoScale))}
                                className="!min-h-0 !w-6 !h-6 !p-0 !rounded-lg !bg-transparent !text-gray-500 hover:!text-gray-900 dark:hover:!text-white hover:!bg-gray-100 dark:hover:!bg-white/10 active:!scale-90"
                                icon={<Plus className="h-3 w-3" />}
                            />

                            <div className="w-px h-4 bg-gray-200 dark:bg-white/10 mx-1" />

                            <Button
                                variant="ghost"
                                onClick={() => { setZoomDelta(0); }}
                                className="!min-h-0 !px-1.5 !rounded-lg !bg-transparent !text-[9px] !font-black !normal-case !tracking-normal !text-blue-600 hover:!bg-blue-50 dark:hover:!bg-blue-600/10 whitespace-nowrap !min-w-[32px]"
                            >
                                {Math.round(previewScale * 100)}%
                            </Button>

                            <div className="w-px h-4 bg-gray-200 dark:bg-white/10 mx-1" />

                            <Button onClick={calcAutoScale} title={"Fit To Window"}
                                variant="ghost"
                                className="!min-h-0 !w-6 !h-6 !p-0 !rounded-lg !bg-transparent !text-gray-500 hover:!text-gray-900 dark:hover:!text-white hover:!bg-gray-100 dark:hover:!bg-white/10 active:!scale-90"
                                icon={<Maximize2 className="h-3 w-3" />}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        <div className="flex flex-col items-center py-4 px-2 min-h-full">
                            <div ref={componentRef} className="print:bg-transparent flex flex-col items-center">
                                {paperSize === 'A4' ? (
                                    pages.map((page, pi) => (
                                        <div key={`pw-${pi}`} className="flex flex-col items-center">
                                            <div className="page-indicator print:hidden flex items-center gap-2 my-2.5"
                                                style={{ width: `${A4_W * previewScale}px`, maxWidth: 'calc(100vw - 32px)' }}>
                                                <div className="h-px flex-1 bg-gray-300 dark:bg-white/10" />
                                                <span className="flex items-center gap-1.5 text-[8px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest px-2.5 py-1 rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm whitespace-nowrap">
                                                    <span className="text-blue-500">●</span> {"page"} {pi + 1} / {pages.length}
                                                </span>
                                                <div className="h-px flex-1 bg-gray-300 dark:bg-white/10" />
                                            </div>

                                            <div className="print-page bg-white shadow-2xl print:shadow-none"
                                                data-capture-id={`page-${pi}`}
                                                style={{
                                                    width: `${A4_W}px`,
                                                    height: `${A4_H}px`,
                                                    transform: `scale(${previewScale})`,
                                                    transformOrigin: 'top center',
                                                    marginBottom: `${(A4_H * previewScale) - A4_H + 16}px`,
                                                    display: 'grid',
                                                    gridTemplateColumns: `repeat(${a4Columns},1fr)`,
                                                    gridTemplateRows: `repeat(${a4Rows},1fr)`,
                                                    alignContent: 'stretch',
                                                    gap: `${gapY}px ${gapX}px`,
                                                    padding: '19px',
                                                    boxSizing: 'border-box',
                                                    backgroundColor: 'white',
                                                    overflow: 'hidden',
                                                    flexShrink: 0,
                                                }}>
                                                {page.map(item => renderCard(item.product, item.id))}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex flex-col items-center pt-3 print:pt-0">
                                        {allLabels.map(item => renderCard(item.product, item.id))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <style>{`
                        @media print {
                            .print-page {
                                transform: none !important;
                                margin-bottom: 0 !important;
                                width: 210mm !important;
                                height: 297mm !important;
                                padding: 5mm !important;
                            }
                            .label-to-print {
                                transform: none !important;
                                margin-bottom: 0 !important;
                                border: none !important;
                                box-shadow: none !important;
                            }
                            .page-indicator { display: none !important; }
                        }
                    `}</style>
                </div>
            </div>
        </div>
    );
}

export default BarcodeGenerator;
