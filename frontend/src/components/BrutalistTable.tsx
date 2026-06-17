import React, { useMemo, useState } from 'react';
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableContainer, 
    TableHead, 
    TableRow, 
    Paper, 
    Typography,
    useTheme,
    alpha,
    Box
} from '@mui/material';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';

export interface ColumnDef<T> {
    id: keyof T | string;
    label: string;
    align?: 'left' | 'center' | 'right';
    render?: (row: T) => React.ReactNode;
}

export interface BrutalistTableProps<T> {
    data: T[];
    columns: ColumnDef<T>[];
    groupBy?: keyof T; // Ej: 'matriz' para agrupar escenarios por matriz
    groupLabelPrefix?: string; // Ej: 'Matriz: ' o 'Ciclo: '
}

/**
 * Componente de Tabla Neo-Brutalista
 * Extrae todas sus reglas de diseño (bordes, sombras, colores de filas/grupos) 
 * dinámicamente desde el objeto AppTheme inyectado en theme.palette.custom
 */
export function BrutalistTable<T extends Record<string, any>>({ 
    data, 
    columns, 
    groupBy,
    groupLabelPrefix = ''
}: BrutalistTableProps<T>) {
    const theme = useTheme();
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    const toggleGroup = (groupName: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupName)) next.delete(groupName);
            else next.add(groupName);
            return next;
        });
    };

    // 1. Extraer los estilos neo-brutalistas inyectados en la paleta
    const customStyles = theme.palette.custom || {};
    const borderWidth = customStyles.borderWidth || '1px';
    const borderStyle = `${borderWidth} solid ${customStyles.border || theme.palette.divider}`;
    const borderRadius = theme.shape.borderRadius;
    const boxShadow = customStyles.boxShadow;
    
    // Colores específicos para la tabla
    const tableHeaderBg = customStyles.tableHeaderBg || alpha(theme.palette.primary.main, 0.1);
    const tableRowHoverBg = customStyles.tableRowHoverBg || theme.palette.action.hover;
    const tableRowGroupBg = customStyles.tableRowGroupBg || alpha(theme.palette.secondary.main, 0.1);

    // 2. Lógica para agrupar los datos de la tabla por la propiedad `groupBy`
    const groupedData = useMemo(() => {
        if (!groupBy) return { ungrouped: data };
        
        const groups: Record<string, T[]> = {};
        data.forEach(row => {
            const groupValue = String(row[groupBy] || 'Sin Grupo');
            if (!groups[groupValue]) {
                groups[groupValue] = [];
            }
            groups[groupValue].push(row);
        });
        return groups;
    }, [data, groupBy]);

    return (
        <TableContainer 
            component={Paper} 
            elevation={0}
            sx={{
                // Estilo Brutalista del contenedor
                borderRadius: borderRadius,
                border: borderStyle,
                boxShadow: boxShadow !== 'none' ? boxShadow : undefined,
                overflow: 'hidden',
                bgcolor: customStyles.bgCanvas || 'background.paper',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                mb: 4,
                '&:hover': boxShadow && boxShadow !== 'none' ? {
                    boxShadow: 'none',
                    transform: 'translate(4px, 4px)', // Animación brutalista de hundimiento
                } : {}
            }}
        >
            <Table size="small" sx={{ minWidth: 650 }} aria-label="brutalist table">
                
                {/* Cabecera de la tabla */}
                <TableHead sx={{ bgcolor: tableHeaderBg }}>
                    <TableRow>
                        {columns.map((col) => (
                            <TableCell 
                                key={col.id as string} 
                                align={col.align || 'left'}
                                sx={{ 
                                    fontWeight: 800, // Letra audaz y robusta
                                    borderBottom: borderStyle,
                                    borderRight: borderStyle, // Celdas estilo grilla de Excel para potenciar el look rígido
                                    color: 'text.primary',
                                    py: 2,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    '&:last-child': { borderRight: 'none' }
                                }}
                            >
                                {col.label}
                            </TableCell>
                        ))}
                    </TableRow>
                </TableHead>

                <TableBody>
                    {Object.entries(groupedData).map(([groupName, rows], groupIndex) => (
                        <React.Fragment key={`group-${groupName}-${groupIndex}`}>
                            
                            {/* Fila Agrupadora Estricta (Ej: Matriz 1, Matriz 2) */}
                            {groupBy && groupName !== 'ungrouped' && (
                                <TableRow 
                                    sx={{ 
                                        bgcolor: tableRowGroupBg,
                                        cursor: 'pointer',
                                        '&:hover': { filter: 'brightness(0.95)' }
                                    }}
                                    onClick={() => toggleGroup(groupName)}
                                >
                                    <TableCell 
                                        colSpan={columns.length} 
                                        sx={{ 
                                            fontWeight: 800, // Audaz como indicaste
                                            borderBottom: borderStyle,
                                            color: 'text.primary',
                                            py: 1.5,
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {collapsedGroups.has(groupName) ? (
                                                <KeyboardArrowRightRoundedIcon fontSize="small" />
                                            ) : (
                                                <KeyboardArrowDownRoundedIcon fontSize="small" />
                                            )}
                                            <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '0.9rem' }}>
                                                {groupLabelPrefix}{groupName}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )}

                            {/* Filas de Datos Individuales (Escenarios) */}
                            {!collapsedGroups.has(groupName) && rows.map((row, rowIndex) => (
                                <TableRow 
                                    key={`row-${groupName}-${rowIndex}`}
                                    sx={{ 
                                        bgcolor: 'background.paper', // Fondo blanco/gris oscuro base
                                        '&:hover': { bgcolor: tableRowHoverBg }, // Efecto hover en fila
                                        transition: 'background-color 0.2s ease',
                                        '&:last-child td, &:last-child th': {
                                            borderBottom: (groupIndex === Object.keys(groupedData).length - 1) ? 0 : borderStyle
                                        }
                                    }}
                                >
                                    {columns.map((col) => (
                                        <TableCell 
                                            key={`cell-${col.id as string}-${rowIndex}`} 
                                            align={col.align || 'left'}
                                            sx={{ 
                                                borderBottom: borderStyle,
                                                borderRight: borderStyle,
                                                color: 'text.primary',
                                                fontWeight: 500,
                                                py: 1.5,
                                                '&:last-child': { borderRight: 'none' }
                                            }}
                                        >
                                            {col.render ? col.render(row) : (row[col.id as keyof T] as React.ReactNode)}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </React.Fragment>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

export default BrutalistTable;
